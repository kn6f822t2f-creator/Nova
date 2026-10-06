#include "spoofer.h"
#include <ndis.h>
#include <ntstrsafe.h>

#define OID_802_3_PERMANENT_ADDRESS 0x01010101
#define OID_802_3_CURRENT_ADDRESS   0x01010102
#define IOCTL_NDIS_QUERY_GLOBAL_STATS CTL_CODE(FILE_DEVICE_PHYSICAL_NETCARD, 0, METHOD_OUT_DIRECT, FILE_ANY_ACCESS)

static PDRIVER_DISPATCH g_OrigNdisInternal = NULL;
static UCHAR            g_FakeMac[MAC_LEN]  = {0};

static NTSTATUS NicIrpComplete(PDEVICE_OBJECT DevObj, PIRP Irp, PVOID Context) {
    UNREFERENCED_PARAMETER(DevObj); UNREFERENCED_PARAMETER(Context);
    if (NT_SUCCESS(Irp->IoStatus.Status)) {
        PIO_STACK_LOCATION stk = IoGetCurrentIrpStackLocation(Irp);
        if (stk->Parameters.DeviceIoControl.IoControlCode == IOCTL_NDIS_QUERY_GLOBAL_STATS) {
            PULONG pOid = (PULONG)stk->Parameters.DeviceIoControl.Type3InputBuffer;
            if (pOid && (*pOid==OID_802_3_PERMANENT_ADDRESS||*pOid==OID_802_3_CURRENT_ADDRESS)) {
                PVOID outBuf = Irp->MdlAddress ?
                    MmGetSystemAddressForMdlSafe(Irp->MdlAddress, NormalPagePriority) :
                    Irp->UserBuffer;
                if (outBuf && Irp->IoStatus.Information >= MAC_LEN)
                    RtlCopyMemory(outBuf, g_FakeMac, MAC_LEN);
            }
        }
    }
    if (Irp->PendingReturned) IoMarkIrpPending(Irp);
    return Irp->IoStatus.Status;
}

static NTSTATUS HookedNdisInternal(PDEVICE_OBJECT DevObj, PIRP Irp) {
    PIO_STACK_LOCATION stk = IoGetCurrentIrpStackLocation(Irp);
    if (stk->MajorFunction == IRP_MJ_INTERNAL_DEVICE_CONTROL &&
        stk->Parameters.DeviceIoControl.IoControlCode == IOCTL_NDIS_QUERY_GLOBAL_STATS) {
        PULONG pOid = (PULONG)stk->Parameters.DeviceIoControl.Type3InputBuffer;
        if (pOid && (*pOid==OID_802_3_PERMANENT_ADDRESS||*pOid==OID_802_3_CURRENT_ADDRESS)) {
            IoCopyCurrentIrpStackLocationToNext(Irp);
            IoSetCompletionRoutine(Irp, NicIrpComplete, NULL, TRUE, TRUE, TRUE);
            return g_OrigNdisInternal(DevObj, Irp);
        }
    }
    return g_OrigNdisInternal(DevObj, Irp);
}

static void Nic_PatchRegistryMac(void) {
    WCHAR macStr[18];
    RtlStringCchPrintfW(macStr, ARRAYSIZE(macStr), L"%02X-%02X-%02X-%02X-%02X-%02X",
        g_FakeMac[0],g_FakeMac[1],g_FakeMac[2],g_FakeMac[3],g_FakeMac[4],g_FakeMac[5]);
    UNICODE_STRING keyPath = RTL_CONSTANT_STRING(
        L"\\Registry\\Machine\\SYSTEM\\CurrentControlSet\\Control\\Class\\"
        L"{4D36E972-E325-11CE-BFC1-08002BE10318}");
    OBJECT_ATTRIBUTES oa; HANDLE hBase;
    InitializeObjectAttributes(&oa, &keyPath, OBJ_CASE_INSENSITIVE|OBJ_KERNEL_HANDLE, NULL, NULL);
    if (!NT_SUCCESS(ZwOpenKey(&hBase, KEY_READ, &oa))) return;
    ULONG idx=0; UCHAR buf[256]; ULONG resultLen;
    PKEY_BASIC_INFORMATION kbi = (PKEY_BASIC_INFORMATION)buf;
    while (NT_SUCCESS(ZwEnumerateKey(hBase, idx++, KeyBasicInformation, kbi, sizeof(buf), &resultLen))) {
        WCHAR subPath[512];
        RtlStringCchPrintfW(subPath, ARRAYSIZE(subPath),
            L"\\Registry\\Machine\\SYSTEM\\CurrentControlSet\\Control\\Class\\"
            L"{4D36E972-E325-11CE-BFC1-08002BE10318}\\%.*s",
            (int)(kbi->NameLength/sizeof(WCHAR)), kbi->Name);
        UNICODE_STRING sub; RtlInitUnicodeString(&sub, subPath);
        OBJECT_ATTRIBUTES subOa;
        InitializeObjectAttributes(&subOa, &sub, OBJ_CASE_INSENSITIVE|OBJ_KERNEL_HANDLE, NULL, NULL);
        HANDLE hSub;
        if (!NT_SUCCESS(ZwOpenKey(&hSub, KEY_SET_VALUE, &subOa))) continue;
        UNICODE_STRING vName = RTL_CONSTANT_STRING(L"NetworkAddress");
        ULONG dataBytes = (ULONG)((wcslen(macStr)+1)*sizeof(WCHAR));
        ZwSetValueKey(hSub, &vName, 0, REG_SZ, macStr, dataBytes);
        ZwClose(hSub);
    }
    ZwClose(hBase);
}

NTSTATUS Nic_Init(void) {
    Gen_Mac(g_FakeMac);
    Nic_PatchRegistryMac();
    UNICODE_STRING name = RTL_CONSTANT_STRING(L"\\Driver\\NDIS");
    PDRIVER_OBJECT ndis = NULL;
    NTSTATUS status = ObReferenceObjectByName(
        &name, OBJ_CASE_INSENSITIVE, NULL, 0,
        *IoDriverObjectType, KernelMode, NULL, (PVOID*)&ndis);
    if (!NT_SUCCESS(status)) return STATUS_SUCCESS;
    g_OrigNdisInternal = (PDRIVER_DISPATCH)InterlockedExchangePointer(
        (PVOID*)&ndis->MajorFunction[IRP_MJ_INTERNAL_DEVICE_CONTROL], HookedNdisInternal);
    ObDereferenceObject(ndis);
    return STATUS_SUCCESS;
}

void Nic_Cleanup(void) {
    if (!g_OrigNdisInternal) return;
    UNICODE_STRING name = RTL_CONSTANT_STRING(L"\\Driver\\NDIS");
    PDRIVER_OBJECT ndis = NULL;
    if (!NT_SUCCESS(ObReferenceObjectByName(
            &name, OBJ_CASE_INSENSITIVE, NULL, 0,
            *IoDriverObjectType, KernelMode, NULL, (PVOID*)&ndis))) return;
    InterlockedExchangePointer(
        (PVOID*)&ndis->MajorFunction[IRP_MJ_INTERNAL_DEVICE_CONTROL], g_OrigNdisInternal);
    g_OrigNdisInternal = NULL;
    ObDereferenceObject(ndis);
}

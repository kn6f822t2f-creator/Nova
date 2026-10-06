#include "spoofer.h"
#include <ntddstor.h>

DISK_HOOK g_DiskHooks[MAX_DISKS] = {0};
ULONG     g_DiskHookCount = 0;

static const WCHAR* k_DiskDriverNames[] = {
    L"\\Driver\\Disk",
    L"\\Driver\\nvme",
    L"\\Driver\\stornvme",
    L"\\Driver\\iaStorAVC",
};

static PDRIVER_DISPATCH g_OrigDiskDispatches[ARRAYSIZE(k_DiskDriverNames)] = {0};
static CHAR g_FakeSerials[ARRAYSIZE(k_DiskDriverNames)][SERIAL_LEN + 1];

static NTSTATUS DiskIrpComplete(
    PDEVICE_OBJECT DevObj, PIRP Irp, PVOID Context
) {
    UNREFERENCED_PARAMETER(DevObj);
    PCHAR fakeSerial = (PCHAR)Context;
    if (NT_SUCCESS(Irp->IoStatus.Status) &&
        Irp->IoStatus.Information >= sizeof(STORAGE_DEVICE_DESCRIPTOR))
    {
        PSTORAGE_DEVICE_DESCRIPTOR desc =
            (PSTORAGE_DEVICE_DESCRIPTOR)Irp->AssociatedIrp.SystemBuffer;
        if (desc &&
            desc->Version >= sizeof(STORAGE_DEVICE_DESCRIPTOR) &&
            desc->SerialNumberOffset != 0 &&
            desc->SerialNumberOffset < desc->Size)
        {
            PCHAR serial = (PCHAR)desc + desc->SerialNumberOffset;
            ULONG avail  = desc->Size - desc->SerialNumberOffset;
            ULONG cplen  = (ULONG)min(strlen(fakeSerial) + 1, avail);
            RtlCopyMemory(serial, fakeSerial, cplen);
        }
    }
    if (Irp->PendingReturned) IoMarkIrpPending(Irp);
    return Irp->IoStatus.Status;
}

#define MAKE_HOOK(idx)                                                              \
static NTSTATUS HookedDiskDispatch##idx(PDEVICE_OBJECT DevObj, PIRP Irp) {         \
    PIO_STACK_LOCATION stk = IoGetCurrentIrpStackLocation(Irp);                    \
    if (stk->MajorFunction == IRP_MJ_DEVICE_CONTROL &&                             \
        stk->Parameters.DeviceIoControl.IoControlCode == IOCTL_STORAGE_QUERY_PROPERTY) \
    {                                                                               \
        PSTORAGE_PROPERTY_QUERY q =                                                 \
            (PSTORAGE_PROPERTY_QUERY)Irp->AssociatedIrp.SystemBuffer;              \
        if (q && q->PropertyId == StorageDeviceProperty &&                          \
            stk->Parameters.DeviceIoControl.OutputBufferLength >=                  \
                sizeof(STORAGE_DEVICE_DESCRIPTOR))                                 \
        {                                                                           \
            IoCopyCurrentIrpStackLocationToNext(Irp);                               \
            IoSetCompletionRoutine(Irp, DiskIrpComplete,                            \
                g_FakeSerials[idx], TRUE, TRUE, TRUE);                              \
            return g_OrigDiskDispatches[idx](DevObj, Irp);                          \
        }                                                                           \
    }                                                                               \
    return g_OrigDiskDispatches[idx](DevObj, Irp);                                  \
}

MAKE_HOOK(0)
MAKE_HOOK(1)
MAKE_HOOK(2)
MAKE_HOOK(3)

static PDRIVER_DISPATCH k_HookFuncs[] = {
    HookedDiskDispatch0, HookedDiskDispatch1,
    HookedDiskDispatch2, HookedDiskDispatch3,
};

NTSTATUS Disk_Init(void) {
    ULONG hooked = 0;
    for (ULONG i = 0; i < ARRAYSIZE(k_DiskDriverNames); i++) {
        UNICODE_STRING name;
        RtlInitUnicodeString(&name, k_DiskDriverNames[i]);
        PDRIVER_OBJECT drv = NULL;
        NTSTATUS status = ObReferenceObjectByName(
            &name, OBJ_CASE_INSENSITIVE, NULL, 0,
            *IoDriverObjectType, KernelMode, NULL, (PVOID*)&drv);
        if (!NT_SUCCESS(status)) continue;
        Gen_Serial(g_FakeSerials[i], SERIAL_LEN);
        g_OrigDiskDispatches[i] = (PDRIVER_DISPATCH)InterlockedExchangePointer(
            (PVOID*)&drv->MajorFunction[IRP_MJ_DEVICE_CONTROL], k_HookFuncs[i]);
        ObDereferenceObject(drv);
        hooked++;
    }
    return hooked ? STATUS_SUCCESS : STATUS_DEVICE_NOT_CONNECTED;
}

void Disk_Cleanup(void) {
    for (ULONG i = 0; i < ARRAYSIZE(k_DiskDriverNames); i++) {
        if (!g_OrigDiskDispatches[i]) continue;
        UNICODE_STRING name;
        RtlInitUnicodeString(&name, k_DiskDriverNames[i]);
        PDRIVER_OBJECT drv = NULL;
        if (!NT_SUCCESS(ObReferenceObjectByName(
                &name, OBJ_CASE_INSENSITIVE, NULL, 0,
                *IoDriverObjectType, KernelMode, NULL, (PVOID*)&drv))) continue;
        InterlockedExchangePointer(
            (PVOID*)&drv->MajorFunction[IRP_MJ_DEVICE_CONTROL],
            g_OrigDiskDispatches[i]);
        g_OrigDiskDispatches[i] = NULL;
        ObDereferenceObject(drv);
    }
}

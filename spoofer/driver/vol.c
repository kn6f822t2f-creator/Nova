#include "spoofer.h"
#include <ntifs.h>

typedef struct _FILE_FS_VOLUME_INFORMATION {
    LARGE_INTEGER VolumeCreationTime;
    ULONG         VolumeSerialNumber;
    ULONG         VolumeLabelLength;
    BOOLEAN       SupportsObjects;
    WCHAR         VolumeLabel[1];
} FILE_FS_VOLUME_INFORMATION_EX;

#define FS_VOLUME_INFORMATION_CLASS 1

static const WCHAR* k_FsDrivers[] = {
    L"\\FileSystem\\Ntfs",
    L"\\FileSystem\\FastFat",
    L"\\FileSystem\\Refs",
};

static PDRIVER_DISPATCH g_OrigFsDispatches[ARRAYSIZE(k_FsDrivers)] = {0};
static ULONG            g_FakeVolSerials[ARRAYSIZE(k_FsDrivers)]    = {0};

static NTSTATUS VolIrpComplete(PDEVICE_OBJECT DevObj, PIRP Irp, PVOID Context) {
    UNREFERENCED_PARAMETER(DevObj);
    ULONG fakeSerial = (ULONG)(ULONG_PTR)Context;
    if (NT_SUCCESS(Irp->IoStatus.Status) &&
        Irp->IoStatus.Information >= FIELD_OFFSET(FILE_FS_VOLUME_INFORMATION_EX, VolumeLabel))
    {
        PVOID buf = Irp->MdlAddress ?
            MmGetSystemAddressForMdlSafe(Irp->MdlAddress, NormalPagePriority) :
            Irp->AssociatedIrp.SystemBuffer;
        if (buf) ((FILE_FS_VOLUME_INFORMATION_EX*)buf)->VolumeSerialNumber = fakeSerial;
    }
    if (Irp->PendingReturned) IoMarkIrpPending(Irp);
    return Irp->IoStatus.Status;
}

#define MAKE_FS_HOOK(idx)                                                           \
static NTSTATUS HookedFsDispatch##idx(PDEVICE_OBJECT DevObj, PIRP Irp) {            \
    PIO_STACK_LOCATION stk = IoGetCurrentIrpStackLocation(Irp);                    \
    if (stk->MajorFunction == IRP_MJ_QUERY_VOLUME_INFORMATION &&                   \
        stk->Parameters.QueryVolume.FsInformationClass == FS_VOLUME_INFORMATION_CLASS && \
        stk->Parameters.QueryVolume.Length >=                                       \
            FIELD_OFFSET(FILE_FS_VOLUME_INFORMATION_EX, VolumeLabel))               \
    {                                                                               \
        IoCopyCurrentIrpStackLocationToNext(Irp);                                   \
        IoSetCompletionRoutine(Irp, VolIrpComplete,                                 \
            (PVOID)(ULONG_PTR)g_FakeVolSerials[idx], TRUE, TRUE, TRUE);             \
        return g_OrigFsDispatches[idx](DevObj, Irp);                                \
    }                                                                               \
    return g_OrigFsDispatches[idx](DevObj, Irp);                                    \
}

MAKE_FS_HOOK(0)
MAKE_FS_HOOK(1)
MAKE_FS_HOOK(2)

static PDRIVER_DISPATCH k_FsHookFuncs[] = {
    HookedFsDispatch0, HookedFsDispatch1, HookedFsDispatch2,
};

NTSTATUS Vol_Init(void) {
    ULONG hooked = 0;
    for (ULONG i = 0; i < ARRAYSIZE(k_FsDrivers); i++) {
        UNICODE_STRING name; RtlInitUnicodeString(&name, k_FsDrivers[i]);
        PDRIVER_OBJECT drv = NULL;
        NTSTATUS status = ObReferenceObjectByName(
            &name, OBJ_CASE_INSENSITIVE, NULL, 0,
            *IoDriverObjectType, KernelMode, NULL, (PVOID*)&drv);
        if (!NT_SUCCESS(status)) continue;
        g_FakeVolSerials[i] = (ULONG)(Rng_Next(&g_Rng) & 0xFFFFFFFF);
        g_OrigFsDispatches[i] = (PDRIVER_DISPATCH)InterlockedExchangePointer(
            (PVOID*)&drv->MajorFunction[IRP_MJ_QUERY_VOLUME_INFORMATION], k_FsHookFuncs[i]);
        ObDereferenceObject(drv);
        hooked++;
    }
    return hooked ? STATUS_SUCCESS : STATUS_NOT_FOUND;
}

void Vol_Cleanup(void) {
    for (ULONG i = 0; i < ARRAYSIZE(k_FsDrivers); i++) {
        if (!g_OrigFsDispatches[i]) continue;
        UNICODE_STRING name; RtlInitUnicodeString(&name, k_FsDrivers[i]);
        PDRIVER_OBJECT drv = NULL;
        if (!NT_SUCCESS(ObReferenceObjectByName(
                &name, OBJ_CASE_INSENSITIVE, NULL, 0,
                *IoDriverObjectType, KernelMode, NULL, (PVOID*)&drv))) continue;
        InterlockedExchangePointer(
            (PVOID*)&drv->MajorFunction[IRP_MJ_QUERY_VOLUME_INFORMATION], g_OrigFsDispatches[i]);
        g_OrigFsDispatches[i] = NULL;
        ObDereferenceObject(drv);
    }
}

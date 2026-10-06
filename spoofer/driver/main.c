#include "spoofer.h"
#include <ntstrsafe.h>

DRIVER_UNLOAD SpooferUnload;
void SpooferUnload(PDRIVER_OBJECT DriverObject) {
    UNREFERENCED_PARAMETER(DriverObject);
    Vol_Cleanup();
    Nic_Cleanup();
    Disk_Cleanup();
}

NTSTATUS DriverEntry(
    PDRIVER_OBJECT  DriverObject,
    PUNICODE_STRING RegistryPath
) {
    UNREFERENCED_PARAMETER(RegistryPath);

    DriverObject->DriverUnload = SpooferUnload;

    Rng_Init(&g_Rng);

    NTSTATUS s = Smbios_Patch();
    UNREFERENCED_PARAMETER(s);

    Registry_Spoof();

    s = Disk_Init();
    if (!NT_SUCCESS(s))
        return s;

    Vol_Init();
    Nic_Init();

    return STATUS_SUCCESS;
}

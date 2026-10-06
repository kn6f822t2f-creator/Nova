#include "spoofer.h"
#include <ntstrsafe.h>

static NTSTATUS Reg_WriteStr(PCWSTR keyPath, PCWSTR valueName, PCWSTR data) {
    UNICODE_STRING kPath, vName;
    OBJECT_ATTRIBUTES oa; HANDLE hKey = NULL;
    RtlInitUnicodeString(&kPath, keyPath);
    InitializeObjectAttributes(&oa, &kPath, OBJ_CASE_INSENSITIVE|OBJ_KERNEL_HANDLE, NULL, NULL);
    NTSTATUS status = ZwOpenKey(&hKey, KEY_SET_VALUE, &oa);
    if (!NT_SUCCESS(status)) return status;
    RtlInitUnicodeString(&vName, valueName);
    ULONG dataBytes = (ULONG)((wcslen(data)+1)*sizeof(WCHAR));
    status = ZwSetValueKey(hKey, &vName, 0, REG_SZ, (PVOID)data, dataBytes);
    ZwClose(hKey);
    return status;
}

NTSTATUS Registry_Spoof(void) {
    WCHAR g1[40], g2[40];
    Gen_GuidStr(g1, ARRAYSIZE(g1));
    Gen_GuidStr(g2, ARRAYSIZE(g2));
    Reg_WriteStr(L"\\Registry\\Machine\\SOFTWARE\\Microsoft\\Cryptography", L"MachineGuid", g1);
    Reg_WriteStr(L"\\Registry\\Machine\\SOFTWARE\\Microsoft\\SQMClient", L"MachineId", g2);
    Reg_WriteStr(L"\\Registry\\Machine\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
        L"ProductId", L"00000-00000-00000-00000");
    return STATUS_SUCCESS;
}

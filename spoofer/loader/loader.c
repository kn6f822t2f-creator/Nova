#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <iphlpapi.h>
#include <shlwapi.h>
#include <shlobj.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "resource.h"

#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")

#define DRIVER_NAME     L"NovaSpoofDrv"
#define INSTALL_DIR     L"%ProgramData%\\NovaSpoof"
#define DRIVER_FILENAME L"spoofer.sys"

static void SetColor(WORD a) { SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE), a); }
#define cRESET  SetColor(FOREGROUND_RED|FOREGROUND_GREEN|FOREGROUND_BLUE)
#define cGREEN  SetColor(FOREGROUND_GREEN|FOREGROUND_INTENSITY)
#define cRED    SetColor(FOREGROUND_RED|FOREGROUND_INTENSITY)
#define cYELLOW SetColor(FOREGROUND_RED|FOREGROUND_GREEN|FOREGROUND_INTENSITY)
#define cCYAN   SetColor(FOREGROUND_GREEN|FOREGROUND_BLUE|FOREGROUND_INTENSITY)
#define cDIM    SetColor(FOREGROUND_RED|FOREGROUND_GREEN|FOREGROUND_BLUE)

typedef struct { CHAR DiskSerial[64]; CHAR SmbiosUuid[48]; UCHAR MacAddr[6]; CHAR MachineGuid[48]; DWORD VolumeSerial; } HWID_SNAP;

static void Scan_Disk(PCHAR out, DWORD len) {
    HANDLE h = CreateFileW(L"\\\\.\\PhysicalDrive0", 0, FILE_SHARE_READ|FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
    if (h == INVALID_HANDLE_VALUE) { strncpy_s(out,len,"<access denied>",_TRUNCATE); return; }
    STORAGE_PROPERTY_QUERY q = {StorageDeviceProperty,PropertyStandardQuery};
    BYTE buf[1024]={0}; DWORD ret=0;
    if (!DeviceIoControl(h,IOCTL_STORAGE_QUERY_PROPERTY,&q,sizeof(q),buf,sizeof(buf),&ret,NULL)) {
        CloseHandle(h); strncpy_s(out,len,"<ioctl fail>",_TRUNCATE); return;
    }
    CloseHandle(h);
    STORAGE_DEVICE_DESCRIPTOR* d=(STORAGE_DEVICE_DESCRIPTOR*)buf;
    if (d->SerialNumberOffset && d->SerialNumberOffset<ret) {
        strncpy_s(out,len,(char*)buf+d->SerialNumberOffset,_TRUNCATE);
        for(int i=(int)strlen(out)-1;i>=0&&out[i]==' ';i--) out[i]=0;
    } else strncpy_s(out,len,"<empty>",_TRUNCATE);
}

static void Scan_Smbios(PCHAR out, DWORD len) {
    DWORD need=GetSystemFirmwareTable('RSMB',0,NULL,0);
    if (!need){strncpy_s(out,len,"<n/a>",_TRUNCATE);return;}
    BYTE* raw=(BYTE*)malloc(need); if(!raw){strncpy_s(out,len,"<alloc>",_TRUNCATE);return;}
    GetSystemFirmwareTable('RSMB',0,raw,need);
    WORD tlen=*(WORD*)(raw+2); BYTE* table=raw+4,*end=table+tlen,*p=table;
    while(p+4<=end){
        BYTE type=p[0],flen=p[1]; if(type==127)break;
        if(type==1&&flen>=0x19){
            BYTE* u=p+8;
            sprintf_s(out,len,"%02X%02X%02X%02X-%02X%02X-%02X%02X-%02X%02X-%02X%02X%02X%02X%02X%02X",
                u[3],u[2],u[1],u[0],u[5],u[4],u[7],u[6],u[8],u[9],u[10],u[11],u[12],u[13],u[14],u[15]);
            free(raw); return;
        }
        p+=flen; while(p+1<=end&&!(p[0]==0&&p[1]==0))p++; p+=2;
    }
    free(raw); strncpy_s(out,len,"<type1 not found>",_TRUNCATE);
}

static void Scan_Mac(PUCHAR mac) {
    ULONG sz=0; GetAdaptersInfo(NULL,&sz);
    PIP_ADAPTER_INFO ai=(PIP_ADAPTER_INFO)malloc(sz); if(!ai){memset(mac,0,6);return;}
    if(GetAdaptersInfo(ai,&sz)==NO_ERROR&&ai->AddressLength==6) memcpy(mac,ai->Address,6);
    free(ai);
}

static void Scan_Guid(PCHAR out, DWORD len) {
    HKEY hk;
    if(RegOpenKeyExW(HKEY_LOCAL_MACHINE,L"SOFTWARE\\Microsoft\\Cryptography",0,KEY_READ,&hk))
        {strncpy_s(out,len,"<err>",_TRUNCATE);return;}
    WCHAR w[64]={0};DWORD sz=sizeof(w),t;
    RegQueryValueExW(hk,L"MachineGuid",NULL,&t,(BYTE*)w,&sz);
    RegCloseKey(hk);
    WideCharToMultiByte(CP_ACP,0,w,-1,out,(int)len,NULL,NULL);
}

static void Snapshot(HWID_SNAP* s) {
    Scan_Disk(s->DiskSerial,sizeof(s->DiskSerial));
    Scan_Smbios(s->SmbiosUuid,sizeof(s->SmbiosUuid));
    Scan_Mac(s->MacAddr);
    Scan_Guid(s->MachineGuid,sizeof(s->MachineGuid));
    GetVolumeInformationW(L"C:\\",NULL,0,&s->VolumeSerial,NULL,NULL,NULL,0);
}

static void PrintSnap(const HWID_SNAP* s, const char* label) {
    cCYAN; wprintf(L"\n  [%hs]\n",label); cRESET;
    wprintf(L"  Disk serial   : "); cYELLOW; wprintf(L"%hs\n",s->DiskSerial); cRESET;
    wprintf(L"  SMBIOS UUID   : "); cYELLOW; wprintf(L"%hs\n",s->SmbiosUuid); cRESET;
    wprintf(L"  MAC address   : "); cYELLOW;
    wprintf(L"%02X:%02X:%02X:%02X:%02X:%02X\n",s->MacAddr[0],s->MacAddr[1],s->MacAddr[2],s->MacAddr[3],s->MacAddr[4],s->MacAddr[5]);
    cRESET;
    wprintf(L"  MachineGuid   : "); cYELLOW; wprintf(L"%hs\n",s->MachineGuid); cRESET;
    wprintf(L"  Volume serial : "); cYELLOW;
    wprintf(L"%04X-%04X\n",(s->VolumeSerial>>16)&0xFFFF,s->VolumeSerial&0xFFFF); cRESET;
}

static void CleanTraces(void) {
    wprintf(L"\n  [*] Scanning for AC traces ...\n");
    const wchar_t* dirs[]={ L"%ProgramData%\\Epic Games\\EasyAntiCheat", L"%ProgramData%\\BattlEye",
        L"%LocalAppData%\\Easy Anti-Cheat", L"%LocalAppData%\\EasyAntiCheat",
        L"%ProgramData%\\FaceIt", L"%AppData%\\Vanguard" };
    const wchar_t* exts[]={ L"*.log",L"*.dat",L"*.cache",L"*hwid*" };
    WCHAR exp[MAX_PATH],pat[MAX_PATH]; DWORD n=0;
    for(int i=0;i<ARRAYSIZE(dirs);i++){
        ExpandEnvironmentStringsW(dirs[i],exp,MAX_PATH);
        if(!PathFileExistsW(exp))continue;
        for(int e=0;e<ARRAYSIZE(exts);e++){
            PathCombineW(pat,exp,exts[e]);
            WIN32_FIND_DATAW fd; HANDLE h=FindFirstFileW(pat,&fd);
            if(h==INVALID_HANDLE_VALUE)continue;
            do{ WCHAR full[MAX_PATH]; PathCombineW(full,exp,fd.cFileName);
                if(DeleteFileW(full)){n++;wprintf(L"  [-] %s\n",full);}
            }while(FindNextFileW(h,&fd));
            FindClose(h);
        }
    }
    if(n){cGREEN;wprintf(L"  [+] Cleaned %lu file(s)\n",n);cRESET;}
    else  {cDIM; wprintf(L"  (nothing found)\n");cRESET;}
}

static BOOL ExtractDriver(PWCHAR outPath, DWORD outLen) {
    HRSRC hRes=FindResourceW(NULL,MAKEINTRESOURCEW(IDR_DRIVER),RT_RCDATA);
    if(!hRes){cRED;wprintf(L"  [!] Embedded driver resource not found.\n");cRESET;return FALSE;}
    HGLOBAL hGlob=LoadResource(NULL,hRes);
    PVOID data=LockResource(hGlob);
    DWORD size=SizeofResource(NULL,hRes);
    if(!data||size==0)return FALSE;
    WCHAR dir[MAX_PATH];
    ExpandEnvironmentStringsW(INSTALL_DIR,dir,MAX_PATH);
    CreateDirectoryW(dir,NULL);
    PathCombineW(outPath,dir,DRIVER_FILENAME);
    wprintf(L"  [*] Install dir : %s\n",dir);
    HANDLE hFile=CreateFileW(outPath,GENERIC_WRITE,0,NULL,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL|FILE_ATTRIBUTE_HIDDEN,NULL);
    if(hFile==INVALID_HANDLE_VALUE){cRED;wprintf(L"  [!] Cannot write driver: 0x%08X\n",GetLastError());cRESET;return FALSE;}
    DWORD written=0;
    BOOL ok=WriteFile(hFile,data,size,&written,NULL);
    CloseHandle(hFile);
    if(!ok||written!=size){cRED;wprintf(L"  [!] Driver write incomplete (%lu/%lu)\n",written,size);cRESET;return FALSE;}
    cGREEN;wprintf(L"  [+] Driver extracted (%lu bytes)\n",size);cRESET;
    return TRUE;
}

static void ElevateSeLoadDriver(void) {
    HANDLE t; if(!OpenProcessToken(GetCurrentProcess(),TOKEN_ADJUST_PRIVILEGES|TOKEN_QUERY,&t))return;
    TOKEN_PRIVILEGES tp={1};
    LookupPrivilegeValueW(NULL,SE_LOAD_DRIVER_NAME,&tp.Privileges[0].Luid);
    tp.Privileges[0].Attributes=SE_PRIVILEGE_ENABLED;
    AdjustTokenPrivileges(t,FALSE,&tp,0,NULL,NULL); CloseHandle(t);
}

static BOOL DriverLoad(PCWSTR drvPath) {
    ElevateSeLoadDriver();
    SC_HANDLE scm=OpenSCManagerW(NULL,NULL,SC_MANAGER_CREATE_SERVICE);
    if(!scm){cRED;wprintf(L"  [!] OpenSCManager: 0x%08X\n",GetLastError());cRESET;return FALSE;}
    SC_HANDLE svc=OpenServiceW(scm,DRIVER_NAME,SERVICE_ALL_ACCESS);
    if(svc){SERVICE_STATUS ss;ControlService(svc,SERVICE_CONTROL_STOP,&ss);Sleep(400);DeleteService(svc);CloseServiceHandle(svc);Sleep(150);}
    svc=CreateServiceW(scm,DRIVER_NAME,DRIVER_NAME,SERVICE_ALL_ACCESS,SERVICE_KERNEL_DRIVER,SERVICE_DEMAND_START,SERVICE_ERROR_IGNORE,drvPath,NULL,NULL,NULL,NULL,NULL);
    if(!svc){DWORD e=GetLastError();if(e==ERROR_SERVICE_EXISTS)svc=OpenServiceW(scm,DRIVER_NAME,SERVICE_ALL_ACCESS);
        if(!svc){cRED;wprintf(L"  [!] CreateService: 0x%08X\n",e);cRESET;CloseServiceHandle(scm);return FALSE;}}
    BOOL ok=StartServiceW(svc,0,NULL);
    if(!ok){DWORD e=GetLastError();
        if(e!=ERROR_SERVICE_ALREADY_RUNNING){
            cRED;wprintf(L"  [!] StartService: 0x%08X\n",e);cRESET;
            if(e==0xC0000428||(DWORD)e==(DWORD)ERROR_INVALID_IMAGE_HASH){cYELLOW;wprintf(L"  [!] Signature error: bcdedit /set testsigning on  (reboot)\n");cRESET;}
            CloseServiceHandle(svc);CloseServiceHandle(scm);return FALSE;}}
    CloseServiceHandle(svc);CloseServiceHandle(scm);return TRUE;
}

static void DriverUnload(void) {
    SC_HANDLE scm=OpenSCManagerW(NULL,NULL,SC_MANAGER_CONNECT); if(!scm)return;
    SC_HANDLE svc=OpenServiceW(scm,DRIVER_NAME,SERVICE_ALL_ACCESS);
    if(svc){SERVICE_STATUS ss;ControlService(svc,SERVICE_CONTROL_STOP,&ss);Sleep(400);DeleteService(svc);CloseServiceHandle(svc);}
    CloseServiceHandle(scm);
}

static BOOL IsAdmin(void) {
    BOOL r=FALSE; HANDLE t;
    if(OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&t)){
        TOKEN_ELEVATION te;DWORD len;
        if(GetTokenInformation(t,TokenElevation,&te,sizeof(te),&len))r=(BOOL)te.TokenIsElevated;
        CloseHandle(t);}
    return r;
}

static void RelaunchAdmin(void) {
    WCHAR self[MAX_PATH];GetModuleFileNameW(NULL,self,MAX_PATH);
    SHELLEXECUTEINFOW sei={sizeof(sei)};sei.lpVerb=L"runas";sei.lpFile=self;sei.nShow=SW_NORMAL;
    ShellExecuteExW(&sei);ExitProcess(0);
}

static void Banner(void) {
    cCYAN;
    wprintf(L"\n  ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗\n");
    wprintf(L"  ████╗  ██║██╔═══██╗██║   ██║██╔══██╗\n");
    wprintf(L"  ██╔██╗ ██║██║   ██║██║   ██║███████║\n");
    wprintf(L"  ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║\n");
    wprintf(L"  ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║\n");
    wprintf(L"  ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝\n");
    cDIM;wprintf(L"              HWID Spoofer\n\n");cRESET;
}

int wmain(void) {
    if(!IsAdmin())RelaunchAdmin();
    Banner();
    wprintf(L"  [*] Extracting driver ...\n");
    WCHAR drvPath[MAX_PATH]={0};
    if(!ExtractDriver(drvPath,MAX_PATH)){cRED;wprintf(L"\n  [!] Extraction failed.\n");cRESET;system("pause");return 1;}
    cCYAN;wprintf(L"\n  [*] Reading hardware identifiers ...\n");cRESET;
    HWID_SNAP before={0};Snapshot(&before);PrintSnap(&before,"BEFORE");
    CleanTraces();
    wprintf(L"\n  [*] Loading kernel driver ...\n");
    if(!DriverLoad(drvPath)){cRED;wprintf(L"\n  [!] Driver load failed.\n");cRESET;system("pause");return 1;}
    cGREEN;wprintf(L"  [+] Driver active.\n");cRESET;
    Sleep(600);
    cCYAN;wprintf(L"\n  [*] Verifying spoof ...\n");cRESET;
    HWID_SNAP after={0};Snapshot(&after);PrintSnap(&after,"AFTER");
    wprintf(L"\n  [DIFF]\n");
    BOOL any=FALSE;
#define CHK(f,name) \
    if(memcmp(&before.f,&after.f,sizeof(before.f))!=0){cGREEN;wprintf(L"  [+] %-15s CHANGED\n",name);cRESET;any=TRUE;} \
    else{cYELLOW;wprintf(L"  [~] %-15s unchanged\n",name);cRESET;}
    CHK(DiskSerial,L"Disk serial")
    CHK(SmbiosUuid,L"SMBIOS UUID")
    CHK(MacAddr,L"MAC address")
    CHK(MachineGuid,L"MachineGuid")
    CHK(VolumeSerial,L"Volume serial")
    if(!any){cYELLOW;wprintf(L"\n  [!] Hooks active - AC reads intercepted on game start.\n");cRESET;}
    wprintf(L"\n"); cGREEN;wprintf(L"  SPOOFER ACTIVE  - launch your game now.\n");cRESET;
    wprintf(L"  Press ENTER to unload and exit ...\n\n");
    getwchar();
    DriverUnload();
    DeleteFileW(drvPath);
    cGREEN;wprintf(L"  [+] Driver unloaded. Goodbye.\n\n");cRESET;
    return 0;
}

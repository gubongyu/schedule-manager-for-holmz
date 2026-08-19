//go:build windows

package secret

import (
	"errors"
	"syscall"
	"unsafe"
)

// Windows DPAPI (CryptProtectData/CryptUnprotectData) 구현.
// 현재 로그인 사용자 계정에 묶여 암호화되므로 별도 키 관리가 필요 없다.

const cryptProtectUIForbidden = 0x1

var (
	crypt32           = syscall.NewLazyDLL("crypt32.dll")
	kernel32          = syscall.NewLazyDLL("kernel32.dll")
	procProtectData   = crypt32.NewProc("CryptProtectData")
	procUnprotectData = crypt32.NewProc("CryptUnprotectData")
	procLocalFree     = kernel32.NewProc("LocalFree")
)

type dataBlob struct {
	cbData uint32
	pbData *byte
}

func newBlob(d []byte) *dataBlob {
	if len(d) == 0 {
		return &dataBlob{}
	}
	return &dataBlob{cbData: uint32(len(d)), pbData: &d[0]}
}

func (b *dataBlob) copyAndFree() []byte {
	defer procLocalFree.Call(uintptr(unsafe.Pointer(b.pbData)))
	out := make([]byte, b.cbData)
	copy(out, unsafe.Slice(b.pbData, b.cbData))
	return out
}

type dpapiSealer struct{}

// New 는 DPAPI 기반 Sealer를 반환한다. configDir 는 이 구현에서는 사용하지 않는다.
func New(configDir string) (Sealer, error) { return dpapiSealer{}, nil }

func (dpapiSealer) Seal(data []byte) ([]byte, error) {
	var out dataBlob
	r, _, err := procProtectData.Call(
		uintptr(unsafe.Pointer(newBlob(data))), 0, 0, 0, 0,
		cryptProtectUIForbidden, uintptr(unsafe.Pointer(&out)))
	if r == 0 {
		return nil, errors.Join(errors.New("DPAPI 암호화 실패"), err)
	}
	return out.copyAndFree(), nil
}

func (dpapiSealer) Open(data []byte) ([]byte, error) {
	var out dataBlob
	r, _, err := procUnprotectData.Call(
		uintptr(unsafe.Pointer(newBlob(data))), 0, 0, 0, 0,
		cryptProtectUIForbidden, uintptr(unsafe.Pointer(&out)))
	if r == 0 {
		return nil, errors.Join(errors.New("DPAPI 복호화 실패"), err)
	}
	return out.copyAndFree(), nil
}

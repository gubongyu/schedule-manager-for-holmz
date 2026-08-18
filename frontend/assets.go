// Package frontend 는 정적 UI 자산을 바이너리에 포함한다.
package frontend

import "embed"

//go:embed all:dist
var Assets embed.FS

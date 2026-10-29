package bench

import (
	"math/rand/v2"
	"runtime"
	"testing"

	"github.com/grafana/mimir/pkg/usagetracker/clock"
	v2 "github.com/grafana/mimir/pkg/usagetracker/tenantshard/v2"
)

const n = 10_000_000

func keys() []uint64 {
	r := rand.New(rand.NewPCG(1, 2))
	ks := make([]uint64, n)
	for i := range ks {
		ks[i] = r.Uint64()
	}
	return ks
}

func heap() uint64 {
	runtime.GC()
	runtime.GC()
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return ms.HeapAlloc
}

func TestMemory(t *testing.T) {
	ks := keys()
	for _, presize := range []bool{false, true} {
		before := heap()
		var gm map[uint64]uint8
		if presize {
			gm = make(map[uint64]uint8, n)
		} else {
			gm = map[uint64]uint8{}
		}
		for i, k := range ks {
			gm[k] = uint8(i % 60)
		}
		after := heap()
		t.Logf("go map presize=%v: %.1f bytes/series", presize, float64(after-before)/n)
		runtime.KeepAlive(gm)
		gm = nil

		before = heap()
		var sz uint32
		if presize {
			sz = n
		}
		m := v2.New(sz, 1)
		for i, k := range ks {
			m.Put(k, clock.Minutes(i%60), nil, nil, true)
		}
		after = heap()
		t.Logf("tenantshard presize=%v: %.1f bytes/series (count=%d)", presize, float64(after-before)/n, m.Count())
		runtime.KeepAlive(m)
	}
}

// Cleanup removing ~1/60 of the series (one minute out of 60 distinct values), as in steady state.
func BenchmarkCleanupGoMap(b *testing.B) {
	ks := keys()
	for b.Loop() {
		b.StopTimer()
		gm := make(map[uint64]uint8, n)
		for i, k := range ks {
			gm[k] = uint8(i % 60)
		}
		b.StartTimer()
		for k, v := range gm {
			if v == 0 {
				delete(gm, k)
			}
		}
	}
}

func BenchmarkCleanupTenantShard(b *testing.B) {
	ks := keys()
	for b.Loop() {
		b.StopTimer()
		m := v2.New(n, 1)
		for i, k := range ks {
			m.Put(k, clock.Minutes(i%60), nil, nil, true)
		}
		b.StartTimer()
		m.Cleanup(0, nil)
	}
}

func BenchmarkPutGoMap(b *testing.B) {
	ks := keys()
	gm := make(map[uint64]uint8, n)
	for i, k := range ks {
		gm[k] = uint8(i % 60)
	}
	i := 0
	for b.Loop() {
		gm[ks[i%n]] = 5
		i += 7919
	}
}

func BenchmarkPutTenantShard(b *testing.B) {
	ks := keys()
	m := v2.New(n, 1)
	for i, k := range ks {
		m.Put(k, clock.Minutes(i%60), nil, nil, true)
	}
	i := 0
	for b.Loop() {
		m.Put(ks[i%n], 5, nil, nil, true)
		i += 7919
	}
}

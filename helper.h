#pragma once

#include <cstdint>
#define u64 uint64_t

//c++ pow func doesnt return an integer so for sanity, this.
u64 exponentiation(u64 base, u64 power) {
	u64 result = 1;
	while(power > 0) {
		if(power & 1) {
			result *= base;
		}
		base *= base;
		power >>= 1;
	}
	return result;
}


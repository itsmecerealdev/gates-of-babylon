#include "table.h"
#include <bitset>
#include <cmath>
#include <compare>
#include <cstdint>
#include <iostream>
#include <string>

#define u64 uint64_t

const u64 TEST_INPUTS = 5;

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

std::string inputBitsStr(u64 input, u64 cols) {
	std::string ret;
	u64 colPow = exponentiation(2, cols - 1);
	while(colPow > 0) {
		ret += "\t" + std::to_string((input & colPow) >> cols - 1);
		colPow >>= 1;
		cols--;
	}
	return ret;
}

u64 evaluate() {
	u64 val = 0;
	u64 rows = exponentiation(2, TEST_INPUTS) - 1;
	std::cout << "INPUTS: ";
	for(int j = 0; j < TEST_INPUTS; j++) {
		std::cout << j << "\t";
	}
	std::cout << "OUTPUT";
	std::cout << "\n========================================================================================================\n";
	for(int i = rows; i >= 0; i--) {
		std::cout << std::bitset<TEST_INPUTS>(i);
		std::cout << inputBitsStr(i, TEST_INPUTS);
		std::cout << "\tresult bit here\n";
	}
	return val;
}

int main() {
	evaluate();	
}

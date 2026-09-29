#pragma once

#include "circuit.h"
#include <bitset>
#include <ios>
#include <iostream>
#include <string>


const u64 TEST_INPUTS = 5;

std::string inputBitsStr(u64 input, u64 cols) {
	std::string ret;
	u64 colPow = exponentiation(2, cols - 1);
	while(colPow > 0) {
		ret += "\t" + std::to_string((input & colPow) >> cols - 1);
		colPow >>= 1;
		cols--;
	}
	ret += "\t";
	return ret;
}

u64 evaluate(const Circuit& circuit) {
	u64 val = 0;
	u64 numInputs = circuit.numInputs;
	u64 rows = exponentiation(2, numInputs) - 1;
	std::cout << "INPUTS: ";
	for(int j = 0; j < circuit.numInputs; j++) {
		std::cout << j << "\t";
	}
	std::cout << "OUTPUT";
	std::cout << "\n========================================================================================================\n";
	for(int i = rows; i >= 0; i--) {
		std::cout << i;
		std::cout << inputBitsStr(i, numInputs);
		std::cout << std::boolalpha << circuit.evaluateCircuit(i) << std::endl; 
	}
	return val;
}

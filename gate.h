#pragma once

#include "helper.h"
#include <cmath>
#include <cstdint>
#include <iostream>
#include <vector>

#define gateType uint8_t

constexpr gateType INPUT = 0;
constexpr gateType NOT = 1;
constexpr gateType AND = 2;
constexpr gateType OR = 3;
constexpr gateType NAND = 4;
constexpr gateType NOR = 5;
constexpr gateType XOR = 6;

struct Gate {
	// prevent connecting to another gate, or for validating valid curcuit (all inputs and gates must be connected to exactly one gate, except last gate which is output)
	bool isConnected{};
	gateType type{};
	std::vector<uint64_t> inputs; 
	int idx{-1};

	bool evaluate(const std::vector<Gate>& gates, uint64_t input, uint64_t numInputs) const {
		switch(type) {
			case INPUT:
				return (input >> (numInputs - 1 - idx)) & 1;
			case NOT:
				return !gates.at(inputs.at(0)).evaluate(gates, input, numInputs);
			case AND:
				return gates.at(inputs.at(0)).evaluate(gates, input, numInputs) && gates.at(inputs.at(1)).evaluate(gates, input, numInputs);
			case OR:
				return gates.at(inputs.at(0)).evaluate(gates, input, numInputs) || gates.at(inputs.at(1)).evaluate(gates, input, numInputs);
			case NAND:
				return !(gates.at(inputs.at(0)).evaluate(gates, input, numInputs) && gates.at(inputs.at(1)).evaluate(gates, input, numInputs));
			case NOR:
				return !(gates.at(inputs.at(0)).evaluate(gates, input, numInputs) || gates.at(inputs.at(1)).evaluate(gates, input, numInputs));
			case XOR:
				return gates.at(inputs.at(0)).evaluate(gates, input, numInputs) ^ gates.at(inputs.at(1)).evaluate(gates, input, numInputs);
		}
		std::cerr << "How did I get here? : " << int(type) << std::endl;
		exit(1);
	}
};

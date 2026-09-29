#pragma once
#include "gate.h"
#include <cstdio>
#include <format>
#include <ranges>

struct Circuit {
	std::vector<Gate> gates;
	uint64_t numInputs{};

	void initInputs(int inputCount) {
		numInputs = inputCount;
		for(int i = 0; i < inputCount; i++) {
			Gate input;
			input.type = 0;
			input.idx = i;
			gates.push_back(input);
		}
	}

	void printCircuit() {
		for(const auto& [index, gate] : std::ranges::views::enumerate(gates)) {
			printf("index: %d\ttype: %d\tinputs: %s\thasConnection: %d\n", index, gate.type, format("{}", gate.inputs).c_str(), gate.isConnected);
		}
	}

	bool gateInUse(int index) {
		return gates.at(index).isConnected;
	}

	void markGateInUse(int index) {
		gates.at(index).isConnected = true;
	}

	bool validateCircuit() {
		for(int i = 0; i < gates.size(); i++) {
			const auto& gate = gates.at(i);
			// gate type oob
			if(gate.type < INPUT || gate.type > XOR) return false;
			// gate that is not an input (0 inputs) and doesnt have enough inputs(NOT validates bc 2nd input is garbage but there)
			if(gate.type != INPUT && gate.inputs.size() != 2) return false; 
			// gate is not output gate (last inserted) and isnt connected (shouldnt be possible, but doesn't hurt to verify)
			if(i != gates.size() - 1 && gate.isConnected == false) return false;
		}
		return true;
	}

	bool evaluateCircuit(uint64_t inputBits) const {
		return gates.at(gates.size() - 1).evaluate(gates, inputBits, numInputs);
	}

};

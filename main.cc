#include "table.h"
#include <cstdlib>
#include <iostream>

using namespace std;

void die() {
	cerr << "INVALID INPUT!\n";
	exit(1);
}

int main() {
	Circuit circuit;
	cout << "How many inputs does your logic block have? (1 to 10)" << endl;
	int inputCount = 0;
	cin >> inputCount;
	if(!cin || inputCount < 1 || inputCount > 10) die();
	circuit.initInputs(inputCount);
	circuit.printCircuit();
	int gateType;
	while(true) {
		int input1 = -1;
		int input2 = -1;
		cout << "What sort of gate do you want to add?\n0 - NOT, 1 - AND, 2 - OR, 3 - NAND, 4 - NOR, 5 - XOR, 6 - DONE\n";
		cin >> gateType;
		if(!cin) die();
		// 0 = not in prompt, but 1 in consts
		gateType++;
		if(gateType == 7) break;
		cout << "Give the index for the first input:\n";
		cin >> input1;
		if(!cin || input1 >= circuit.gates.size() || input1 < 0 || circuit.gateInUse(input1)) die(); 
		if(gateType != NOT) {
			cout << "Give the index for the second input:\n";
			cin >> input2;
			if(!cin || input2 >= circuit.gates.size() || input2 < 0 || circuit.gateInUse(input2)) die();
		}
		Gate temp{};
		temp.type = gateType;
		temp.inputs.push_back(input1);
		// this pushes garbage if type == not, but is ignored.
		temp.inputs.push_back(input2);
		circuit.markGateInUse(input1);
		if(gateType != NOT) {
			circuit.markGateInUse(input2);
		}
		circuit.gates.push_back(temp);
	}
	circuit.printCircuit();
	if(!circuit.validateCircuit()) die();
	evaluate(circuit);
}

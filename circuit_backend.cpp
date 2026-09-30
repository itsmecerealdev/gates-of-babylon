#include "circuit.h"
#include "table.h"
#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <map>
#include <cctype>

// Minimal, zero-dependency JSON parser and serializer
namespace MiniJson {
    enum Type { J_NULL, J_BOOL, J_NUMBER, J_STRING, J_ARRAY, J_OBJECT };

    struct Value {
        Type type = J_NULL;
        bool boolVal = false;
        double numVal = 0.0;
        std::string strVal;
        std::vector<Value> arrVal;
        std::map<std::string, Value> objVal;

        bool has(const std::string& key) const {
            return type == J_OBJECT && objVal.find(key) != objVal.end();
        }

        const Value& operator[](const std::string& key) const {
            static Value nullVal;
            if (type != J_OBJECT) return nullVal;
            auto it = objVal.find(key);
            if (it != objVal.end()) return it->second;
            return nullVal;
        }

        const Value& operator[](size_t idx) const {
            static Value nullVal;
            if (type != J_ARRAY || idx >= arrVal.size()) return nullVal;
            return arrVal[idx];
        }

        int asInt(int defaultVal = 0) const {
            if (type == J_NUMBER) return static_cast<int>(numVal);
            return defaultVal;
        }

        uint64_t asU64(uint64_t defaultVal = 0) const {
            if (type == J_NUMBER) return static_cast<uint64_t>(numVal);
            return defaultVal;
        }

        bool asBool(bool defaultVal = false) const {
            if (type == J_BOOL) return boolVal;
            if (type == J_NUMBER) return numVal != 0;
            return defaultVal;
        }

        std::string asString(const std::string& defaultVal = "") const {
            if (type == J_STRING) return strVal;
            return defaultVal;
        }
    };

    inline void skipWhitespace(const std::string& s, size_t& i) {
        while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) {
            i++;
        }
    }

    Value parseValue(const std::string& s, size_t& i);

    inline Value parseString(const std::string& s, size_t& i) {
        Value v;
        v.type = J_STRING;
        i++; // skip open quote
        std::string res;
        while (i < s.size()) {
            char c = s[i++];
            if (c == '"') {
                v.strVal = res;
                return v;
            }
            if (c == '\\' && i < s.size()) {
                char next = s[i++];
                if (next == '"') res += '"';
                else if (next == '\\') res += '\\';
                else if (next == 'n') res += '\n';
                else if (next == 't') res += '\t';
                else if (next == 'r') res += '\r';
                else res += next;
            } else {
                res += c;
            }
        }
        v.strVal = res;
        return v;
    }

    inline Value parseNumber(const std::string& s, size_t& i) {
        Value v;
        v.type = J_NUMBER;
        size_t start = i;
        if (s[i] == '-') i++;
        while (i < s.size() && (std::isdigit(s[i]) || s[i] == '.' || s[i] == 'e' || s[i] == 'E' || s[i] == '+' || s[i] == '-')) {
            i++;
        }
        std::string numStr = s.substr(start, i - start);
        v.numVal = std::stod(numStr);
        return v;
    }

    inline Value parseArray(const std::string& s, size_t& i) {
        Value v;
        v.type = J_ARRAY;
        i++; // skip '['
        skipWhitespace(s, i);
        if (i < s.size() && s[i] == ']') {
            i++;
            return v;
        }
        while (i < s.size()) {
            skipWhitespace(s, i);
            v.arrVal.push_back(parseValue(s, i));
            skipWhitespace(s, i);
            if (i < s.size() && s[i] == ',') {
                i++;
            } else if (i < s.size() && s[i] == ']') {
                i++;
                break;
            } else {
                break;
            }
        }
        return v;
    }

    inline Value parseObject(const std::string& s, size_t& i) {
        Value v;
        v.type = J_OBJECT;
        i++; // skip '{'
        skipWhitespace(s, i);
        if (i < s.size() && s[i] == '}') {
            i++;
            return v;
        }
        while (i < s.size()) {
            skipWhitespace(s, i);
            if (i >= s.size() || s[i] != '"') break;
            Value keyVal = parseString(s, i);
            skipWhitespace(s, i);
            if (i < s.size() && s[i] == ':') i++;
            skipWhitespace(s, i);
            Value val = parseValue(s, i);
            v.objVal[keyVal.strVal] = val;
            skipWhitespace(s, i);
            if (i < s.size() && s[i] == ',') {
                i++;
            } else if (i < s.size() && s[i] == '}') {
                i++;
                break;
            } else {
                break;
            }
        }
        return v;
    }

    inline Value parseValue(const std::string& s, size_t& i) {
        skipWhitespace(s, i);
        if (i >= s.size()) return Value();
        if (s[i] == '"') return parseString(s, i);
        if (s[i] == '{') return parseObject(s, i);
        if (s[i] == '[') return parseArray(s, i);
        if (s[i] == 't' || s[i] == 'f') {
            Value v;
            v.type = J_BOOL;
            if (s.substr(i, 4) == "true") {
                v.boolVal = true;
                i += 4;
            } else if (s.substr(i, 5) == "false") {
                v.boolVal = false;
                i += 5;
            }
            return v;
        }
        if (s[i] == 'n' && s.substr(i, 4) == "null") {
            i += 4;
            return Value();
        }
        return parseNumber(s, i);
    }

    inline Value parse(const std::string& s) {
        size_t i = 0;
        return parseValue(s, i);
    }

    inline std::string escapeStr(const std::string& s) {
        std::string res = "\"";
        for (char c : s) {
            if (c == '"') res += "\\\"";
            else if (c == '\\') res += "\\\\";
            else if (c == '\n') res += "\\n";
            else if (c == '\r') res += "\\r";
            else if (c == '\t') res += "\\t";
            else res += c;
        }
        res += "\"";
        return res;
    }
}

static std::string gateTypeName(gateType type) {
    switch (type) {
        case INPUT: return "INPUT";
        case NOT:   return "NOT";
        case AND:   return "AND";
        case OR:    return "OR";
        case NAND:  return "NAND";
        case NOR:   return "NOR";
        case XOR:   return "XOR";
        default:    return "UNKNOWN";
    }
}

int main(int argc, char* argv[]) {
    std::string inputStr;
    if (argc > 1 && std::string(argv[1]) == "--json" && argc > 2) {
        inputStr = argv[2];
    } else {
        std::string line;
        while (std::getline(std::cin, line)) {
            inputStr += line + "\n";
        }
    }

    if (inputStr.empty()) {
        std::cout << R"({"error": "No input JSON provided"})" << std::endl;
        return 1;
    }

    MiniJson::Value req = MiniJson::parse(inputStr);
    std::string action = req["action"].asString("simulate");
    int numInputs = req["numInputs"].asInt(0);

    if (numInputs < 1 || numInputs > 10) {
        std::cout << "{\"success\": false, \"error\": \"Input count must be between 1 and 10\"}\n";
        return 0;
    }

    Circuit circuit;
    circuit.initInputs(numInputs);

    // Build circuit gates
    const auto& gatesArr = req["gates"].arrVal;
    std::vector<std::string> errors;

    for (size_t gIdx = 0; gIdx < gatesArr.size(); ++gIdx) {
        const auto& gObj = gatesArr[gIdx];
        int type = gObj["type"].asInt(-1);
        int in1 = gObj["input1"].asInt(-1);
        int in2 = gObj["input2"].asInt(-1);

        if (type < NOT || type > XOR) {
            errors.push_back("Gate " + std::to_string(gIdx) + ": Invalid gate type " + std::to_string(type));
            continue;
        }

        if (in1 < 0 || in1 >= static_cast<int>(circuit.gates.size())) {
            errors.push_back("Gate " + std::to_string(gIdx) + ": Invalid input1 index " + std::to_string(in1));
            continue;
        }

        if (type != NOT && (in2 < 0 || in2 >= static_cast<int>(circuit.gates.size()))) {
            errors.push_back("Gate " + std::to_string(gIdx) + ": Invalid input2 index " + std::to_string(in2));
            continue;
        }

        Gate temp{};
        temp.type = static_cast<gateType>(type);
        temp.inputs.push_back(in1);
        temp.inputs.push_back(type == NOT ? static_cast<uint64_t>(-1) : in2);

        circuit.markGateInUse(in1);
        if (type != NOT) {
            circuit.markGateInUse(in2);
        }
        circuit.gates.push_back(temp);
    }

    bool isValid = errors.empty() && circuit.validateCircuit();

    // Map which gate output is connected to which gate index
    // For README format: Output Connected to Index: X
    std::vector<std::string> outputDest(circuit.gates.size(), "OUTPUT PIN");
    for (size_t i = numInputs; i < circuit.gates.size(); ++i) {
        const auto& g = circuit.gates[i];
        if (!g.inputs.empty() && g.inputs[0] < circuit.gates.size()) {
            outputDest[g.inputs[0]] = std::to_string(i);
        }
        if (g.inputs.size() > 1 && g.type != NOT && g.inputs[1] < circuit.gates.size()) {
            outputDest[g.inputs[1]] = std::to_string(i);
        }
    }

    // Format Block Text exactly as Gates of Babylon README
    std::string blockText;
    for (size_t i = 0; i < circuit.gates.size(); ++i) {
        const auto& g = circuit.gates[i];
        blockText += "Gate Type: " + gateTypeName(g.type) + "\n";
        if (g.type == INPUT) {
            blockText += "        Input Connected to Index: N.C. and N.C.\n";
        } else if (g.type == NOT) {
            blockText += "        Input Connected to Index: " + std::to_string(g.inputs[0]) + "\n";
        } else {
            blockText += "        Input Connected to Index: " + std::to_string(g.inputs[0]) + " and " + std::to_string(g.inputs[1]) + "\n";
        }
        blockText += "        Output Connected to Index: " + outputDest[i] + "\n";
        blockText += "        Value: X\n\n";
    }

    // Evaluate gate states for the given input bits
    uint64_t inputBits = req["inputBits"].asU64(0);
    std::vector<int> gateValues(circuit.gates.size(), 0);
    bool overallOutput = false;

    if (isValid && !circuit.gates.empty()) {
        for (size_t i = 0; i < circuit.gates.size(); ++i) {
            gateValues[i] = circuit.gates[i].evaluate(circuit.gates, inputBits, numInputs) ? 1 : 0;
        }
        overallOutput = circuit.evaluateCircuit(inputBits);
    }

    // Output JSON response
    std::ostringstream jsonOut;
    jsonOut << "{\n";
    jsonOut << "  \"success\": true,\n";
    jsonOut << "  \"valid\": " << (isValid ? "true" : "false") << ",\n";
    jsonOut << "  \"numInputs\": " << numInputs << ",\n";
    jsonOut << "  \"totalGates\": " << circuit.gates.size() << ",\n";
    jsonOut << "  \"output\": " << (overallOutput ? 1 : 0) << ",\n";

    // Errors
    jsonOut << "  \"errors\": [";
    for (size_t i = 0; i < errors.size(); ++i) {
        jsonOut << MiniJson::escapeStr(errors[i]) << (i + 1 < errors.size() ? ", " : "");
    }
    jsonOut << "],\n";

    // Gate Values
    jsonOut << "  \"gateValues\": [";
    for (size_t i = 0; i < gateValues.size(); ++i) {
        jsonOut << gateValues[i] << (i + 1 < gateValues.size() ? ", " : "");
    }
    jsonOut << "],\n";

    // Gate Metadata
    jsonOut << "  \"gateInfo\": [\n";
    for (size_t i = 0; i < circuit.gates.size(); ++i) {
        const auto& g = circuit.gates[i];
        jsonOut << "    {\"index\": " << i
                << ", \"type\": " << static_cast<int>(g.type)
                << ", \"typeName\": \"" << gateTypeName(g.type) << "\""
                << ", \"isConnected\": " << (g.isConnected ? "true" : "false")
                << ", \"outputConnectedTo\": \"" << outputDest[i] << "\"";
        jsonOut << ", \"inputs\": [";
        if (g.type != INPUT && !g.inputs.empty()) {
            jsonOut << g.inputs[0];
            if (g.type != NOT && g.inputs.size() > 1) {
                jsonOut << ", " << g.inputs[1];
            }
        }
        jsonOut << "]}";
        if (i + 1 < circuit.gates.size()) jsonOut << ",";
        jsonOut << "\n";
    }
    jsonOut << "  ],\n";

    // Block text (terminal inspection format)
    jsonOut << "  \"blockText\": " << MiniJson::escapeStr(blockText) << ",\n";

    // Truth Table (if requested or valid)
    jsonOut << "  \"truthTable\": {\n";
    jsonOut << "    \"headers\": [";
    for (int i = 0; i < numInputs; ++i) {
        jsonOut << "\"In " << i << "\", ";
    }
    jsonOut << "\"Out\"],\n";

    jsonOut << "    \"rows\": [\n";
    if (isValid) {
        uint64_t totalRows = exponentiation(2, numInputs);
        for (uint64_t r = 0; r < totalRows; ++r) {
            // Match order of table.h: from rows-1 down to 0, or 0 to totalRows-1
            uint64_t rowBits = (totalRows - 1 - r);
            jsonOut << "      {\"index\": " << rowBits << ", \"inputs\": [";
            for (int bit = 0; bit < numInputs; ++bit) {
                int val = (rowBits >> (numInputs - 1 - bit)) & 1;
                jsonOut << val << (bit + 1 < numInputs ? ", " : "");
            }
            bool outVal = circuit.evaluateCircuit(rowBits);
            jsonOut << "], \"output\": " << (outVal ? 1 : 0) << "}";
            if (r + 1 < totalRows) jsonOut << ",";
            jsonOut << "\n";
        }
    }
    jsonOut << "    ]\n";
    jsonOut << "  }\n";
    jsonOut << "}\n";

    std::cout << jsonOut.str();
    return 0;
}

import json
import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Gates of Babylon - Logic Circuit Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Determine C++ backend executable name and location
IS_WINDOWS = platform.system() == "Windows"
CPP_EXE_NAME = "circuit_backend.exe" if IS_WINDOWS else "circuit_backend"
CPP_EXE_PATH = BASE_DIR / CPP_EXE_NAME
CPP_SOURCE_PATH = BASE_DIR / "circuit_backend.cpp"


def ensure_backend_compiled() -> bool:
    """Ensures the C++ binary is compiled. Returns True if executable exists or was compiled."""
    if CPP_EXE_PATH.exists():
        return True

    print(f"[*] C++ backend binary {CPP_EXE_NAME} not found. Attempting to compile...")
    if not CPP_SOURCE_PATH.exists():
        print(f"[!] Source file {CPP_SOURCE_PATH} not found.")
        return False

    if IS_WINDOWS:
        # Try MSVC vcvars64.bat or g++
        msvc_vcvars = Path(r"C:\Program Files\Microsoft Visual Studio\18\Enterprise\VC\Auxiliary\Build\vcvars64.bat")
        if not msvc_vcvars.exists():
            # Search common locations
            for vs_dir in [Path(r"C:\Program Files\Microsoft Visual Studio"), Path(r"C:\Program Files (x86)\Microsoft Visual Studio")]:
                if vs_dir.exists():
                    found = list(vs_dir.glob("**/vcvars64.bat"))
                    if found:
                        msvc_vcvars = found[0]
                        break

        if msvc_vcvars.exists():
            cmd = f'call "{msvc_vcvars}" && cl /std:c++latest /O2 /EHsc "{CPP_SOURCE_PATH.name}" /Fe:"{CPP_EXE_NAME}"'
            print(f"[*] Compiling with MSVC: {cmd}")
            res = subprocess.run(f'cmd.exe /c "{cmd}"', cwd=str(BASE_DIR), capture_output=True, text=True, shell=True)
            if CPP_EXE_PATH.exists():
                print("[+] Successfully compiled C++ backend with MSVC!")
                return True
            print(f"[!] MSVC compilation failed:\n{res.stderr}\n{res.stdout}")

        # Fallback to g++ or clang++ on Windows if in PATH
        for compiler in ["g++", "clang++"]:
            try:
                res = subprocess.run([compiler, "-std=c++23", "-O3", str(CPP_SOURCE_PATH), "-o", str(CPP_EXE_PATH)],
                                     cwd=str(BASE_DIR), capture_output=True, text=True)
                if CPP_EXE_PATH.exists():
                    print(f"[+] Successfully compiled C++ backend with {compiler}!")
                    return True
            except Exception:
                pass
    else:
        # Linux / Docker
        for compiler in ["g++", "clang++"]:
            try:
                res = subprocess.run([compiler, "-std=c++23", "-O3", str(CPP_SOURCE_PATH), "-o", str(CPP_EXE_PATH)],
                                     cwd=str(BASE_DIR), capture_output=True, text=True)
                if CPP_EXE_PATH.exists():
                    print(f"[+] Successfully compiled C++ backend with {compiler}!")
                    return True
                print(f"[!] {compiler} compilation failed:\n{res.stderr}")
            except Exception as e:
                print(f"[!] Could not run {compiler}: {e}")

    return CPP_EXE_PATH.exists()


# Attempt compilation on module load
backend_available = ensure_backend_compiled()


class GateItem(BaseModel):
    type: int
    input1: int
    input2: int = -1


class SimulateRequest(BaseModel):
    numInputs: int
    inputBits: Optional[int] = 0
    inputs: Optional[List[int]] = None
    gates: List[GateItem] = []
    action: Optional[str] = "simulate"


def call_cpp_backend(payload: dict) -> dict:
    """Executes the C++ backend binary and returns parsed JSON output."""
    if not CPP_EXE_PATH.exists():
        if not ensure_backend_compiled():
            raise RuntimeError(f"C++ backend executable {CPP_EXE_PATH} is not compiled and compilation failed.")

    proc = subprocess.Popen(
        [str(CPP_EXE_PATH)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(BASE_DIR),
    )
    stdout, stderr = proc.communicate(input=json.dumps(payload))
    if proc.returncode != 0:
        raise RuntimeError(f"C++ backend exited with code {proc.returncode}: {stderr}")

    try:
        data = json.loads(stdout)
        data["backend"] = "C++ (Native)"
        return data
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse C++ backend JSON output: {stdout}\nError: {e}")


@app.get("/api/status")
def get_status():
    compiled = CPP_EXE_PATH.exists()
    return {
        "status": "ready" if compiled else "needs_build",
        "backend": "C++" if compiled else "not_found",
        "executable": str(CPP_EXE_PATH),
        "os": platform.system(),
        "arch": platform.machine(),
    }


@app.post("/api/simulate")
def simulate_circuit(req: SimulateRequest):
    # Convert input array [1, 0, 1] to integer bitmask if provided
    # In Babylon, pin 0 is MSB or (input >> (numInputs - 1 - idx)) & 1
    input_bits = req.inputBits or 0
    if req.inputs is not None and len(req.inputs) > 0:
        input_bits = 0
        for idx, val in enumerate(req.inputs[:req.numInputs]):
            if val:
                input_bits |= (1 << (req.numInputs - 1 - idx))

    payload = {
        "action": req.action or "simulate",
        "numInputs": req.numInputs,
        "inputBits": input_bits,
        "gates": [
            {
                "type": g.type,
                "input1": g.input1,
                "input2": g.input2,
            }
            for g in req.gates
        ],
    }

    try:
        result = call_cpp_backend(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/truth-table")
def generate_truth_table(req: SimulateRequest):
    payload = {
        "action": "truth_table",
        "numInputs": req.numInputs,
        "inputBits": 0,
        "gates": [
            {
                "type": g.type,
                "input1": g.input1,
                "input2": g.input2,
            }
            for g in req.gates
        ],
    }
    try:
        result = call_cpp_backend(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





# Mount static directory if exists
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    def serve_index():
        root_index = BASE_DIR / "index.html"
        if root_index.exists():
            return FileResponse(str(root_index))
        return FileResponse(str(STATIC_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    reload = os.environ.get("RELOAD", "false").lower() in ("true", "1", "yes")
    print(f"[*] Starting Gates of Babylon WebUI on http://0.0.0.0:{port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=reload)

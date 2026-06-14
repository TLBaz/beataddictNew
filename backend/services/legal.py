from fastapi import HTTPException


def enforce_phase0(req) -> None:
    if not req.license_ok:
        raise HTTPException(status_code=403, detail="License validation failed.")
    if not req.generation_limit_ok:
        raise HTTPException(status_code=429, detail="Generation limit exceeded.")

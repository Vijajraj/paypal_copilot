#!/usr/bin/env python3
"""
Standalone Cryptographic Audit Ledger Verifier for Vasool / paypal_copilot.
Verifies SHA-256 cryptographic chaining across all audit records.
Fails at the exact entry if any payload, hash, or link has been tampered with.

Usage:
    python verify_ledger.py [path/to/local_audit.json]
"""

import sys
import json
import hashlib
from pathlib import Path
from typing import Tuple, Dict, Any, List

def canonical_json(obj: Dict[str, Any]) -> bytes:
    """Canonical JSON serialization per Vasool spec: sorted keys, UTF-8, no extra whitespace."""
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def compute_canonical_entry_hash(prev_hash: str, body: Dict[str, Any]) -> str:
    """Computes SHA256(prev_hash || canonical_json({seq, ts, actor, event_type, ref_id, payload}))"""
    body_bytes = canonical_json(body)
    data = prev_hash.encode('utf-8') + body_bytes
    return hashlib.sha256(data).hexdigest()

def compute_legacy_entry_hash(
    entry_id: str,
    dispute_id: str,
    timestamp: str,
    actor_type: str,
    actor_id: str,
    action: str,
    details: str,
    prev_hash: str
) -> str:
    """Legacy SHA-256 block hash for backward compatibility."""
    payload = f"{entry_id}|{dispute_id or ''}|{timestamp}|{actor_type}:{actor_id}|{action}|{details}|{prev_hash}"
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()

def verify_ledger_file(file_path: Path) -> Tuple[bool, Dict[str, Any]]:
    path = Path(file_path).resolve()
    if not path.exists():
        return False, {"valid": False, "error": f"Ledger file not found: {path}"}

    try:
        with open(path, "r", encoding="utf-8") as f:
            raw_entries = json.load(f)
    except Exception as e:
        return False, {"valid": False, "error": f"Failed to parse ledger JSON: {e}"}

    if not isinstance(raw_entries, list):
        return False, {"valid": False, "error": "Ledger root must be a JSON array of entries"}

    if not raw_entries:
        return True, {"valid": True, "checked_entries": 0, "message": "Ledger is empty"}

    expected_prev = "0000000000000000000000000000000000000000000000000000000000000000"

    for idx, entry in enumerate(raw_entries):
        entry_id = entry.get("entryId", f"index_{idx}")
        prev_hash = entry.get("prevHash", "")
        stored_hash = entry.get("hash", "")

        # 1. Verify prevHash link
        if prev_hash != expected_prev:
            return False, {
                "valid": False,
                "tampered_index": idx,
                "entry_id": entry_id,
                "error": f"Broken chain link at index {idx} ({entry_id}): expected prevHash {expected_prev}, got {prev_hash}"
            }

        # 2. Recalculate hash
        rule = entry.get("rule")
        seq = entry.get("seq")
        payload = entry.get("payload")

        if seq is not None and (rule == "vasool_v1" or payload is not None):
            actor_raw = entry.get("actor") or {}
            actor_dict = {
                "id": actor_raw.get("id", ""),
                "type": actor_raw.get("type", "")
            }
            canonical_body = {
                "actor": actor_dict,
                "event_type": entry.get("event_type") or entry.get("action", ""),
                "payload": payload or {"details": entry.get("details", "")},
                "ref_id": entry.get("ref_id") if entry.get("ref_id") is not None else entry.get("disputeId", ""),
                "seq": seq,
                "ts": entry.get("ts") or entry.get("timestamp", "")
            }
            computed = compute_canonical_entry_hash(prev_hash, canonical_body)
        else:
            actor_raw = entry.get("actor") or {}
            computed = compute_legacy_entry_hash(
                entry_id=entry_id,
                dispute_id=entry.get("disputeId", ""),
                timestamp=entry.get("timestamp", ""),
                actor_type=actor_raw.get("type", ""),
                actor_id=actor_raw.get("id", ""),
                action=entry.get("action", ""),
                details=entry.get("details", ""),
                prev_hash=prev_hash
            )

        # 3. Check hash match
        if computed != stored_hash:
            return False, {
                "valid": False,
                "tampered_index": idx,
                "entry_id": entry_id,
                "error": f"Tampering detected at entry index {idx} ({entry_id}): stored hash {stored_hash}, calculated {computed}"
            }

        expected_prev = stored_hash

    return True, {
        "valid": True,
        "checked_entries": len(raw_entries),
        "latest_hash": expected_prev
    }

def main():
    default_path = Path(__file__).resolve().parent / "app" / "local_audit.json"
    target_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path

    print(f"[Ledger Verifier] Verifying chain in: {target_path}")
    is_valid, report = verify_ledger_file(target_path)

    if is_valid:
        print(f"[SUCCESS] Audit ledger integrity verified! Checked {report.get('checked_entries', 0)} blocks.")
        print(f"Latest Hash: {report.get('latest_hash')}")
        sys.exit(0)
    else:
        print(f"[ERROR] Audit ledger TAMPERING DETECTED!")
        print(f"  Tampered Index: {report.get('tampered_index')}")
        print(f"  Entry ID:       {report.get('entry_id')}")
        print(f"  Reason:         {report.get('error')}")
        sys.exit(1)

if __name__ == "__main__":
    main()

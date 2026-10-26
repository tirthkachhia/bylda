"""Second-pass evidence audit for analyzer-eval.py; local files only, no app writes."""
import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path
import tomllib

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("sales_eval", Path(__file__).with_name("analyzer-eval.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

SYSTEM = """You are a skeptical evidence reviewer, correcting a fallible sales-analysis experiment. Read the full transcript and audit candidate findings. Candidates are untrusted. Return six concise independent assessments and a list of rejected claims.
Rules:
- Attribute every claim to the correct speaker. A rep's statement is NOT evidence of a customer's belief. Refer to actual turn_id values, not positions counted by you.
- Keep observations, interpretations, rep-reported outcomes, and independently verified outcomes distinct. External carrier/policy evidence is absent. Do not say activation or payment is verified. A claimed guarantee is a claim to check, not established falsehood.
- A license claim without independent evidence is NOT by itself suspicious. Giving a contact number for customer support is NOT evidence of unsolicited-contact or privacy misconduct. A rep saying THEY would go to prison for scamming is not a threat of prison against the customer. Do not invent misconduct. Do not make legal conclusions.
- Evaluate general selling independently of script wording/order/options. Preserve good discovery, adaptation and useful decision support even when off script. Closing does not excuse pressure, unresolved resistance, unsupported promises, or poor judgment. A non-close does not establish poor selling.
- Identify separate customer response and sale progression. A weak yes/okay needs its preceding question to establish what was accepted. Sensitive data disclosure does not establish purchase consent. Distinguish agent promises, customer acceptance, reported approval, and actual independently verified activation.
- Link a recommendation to an expressed need/budget without declaring it objectively suitable. Do not assert a move CAUSED the close; say it helped clarify, was followed by, or may have contributed when supported.
- Do not infer confidence of the person, hidden emotion, intent, or interruptions from text.
- Playbook is provided only to evaluate execution. Use it as a process reference, never as the standard of general selling quality or legal correctness. A deviation label requires a specific requirement actually present. Do not invent off-playbook behavior in the flexible playbook.
- Each finding must cite 1-4 supporting turn_ids including both sides when response matters. Do not generate quotes. The host will attach original source text and actual speaker/timestamp. Do not pad the report with weak findings. 1-3 findings per angle is enough.
Return ONLY JSON:
{"angles":[{"angle":"one of the six assigned keys","judgment":"positive|mixed|negative|insufficient_evidence","summary":"qualified specific assessment","findings":[{"claim":"narrow evidence-backed claim","valence":"strength|concern|observation","assertion_type":"observed|inferred|rep_reported|requires_verification","turn_ids":[0],"why":"interpretation with limits"}],"unknowns":["limitation"]}],"rejected_claims":[{"candidate_angle":"key","claim":"claim rejected or narrowed","reason":"why"}],"combined_verdict":"2-3 sentences distinguishing execution, general selling, observed progression, and risk review"}
All six keys: playbook_execution, sales_effectiveness, rep_behavior, customer_state, sales_progression, risk_compliance.
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--results", type=Path, default=Path(".analyzer-eval.local/results"))
    parser.add_argument("--calls", nargs="+", default=base.DEFAULT_CALLS)
    args = parser.parse_args()
    if ".local" not in str(args.results):
        raise ValueError("Private results must remain under an ignored .local directory")
    source = json.loads(args.source.read_text(encoding="utf-8"))
    pb = next(p for p in source["playbooks"] if p["name"] == "Anshs test")
    version = next(v for v in source["versions"] if v["id"] == pb["current_version_id"])
    login = Path(os.environ["APPDATA"]) / "xdg.config/.wrangler/config/default.toml"
    token = tomllib.loads(login.read_text())["oauth_token"]
    for call_id in args.calls:
        rows = json.loads((args.results / f"{call_id}.input.json").read_text(encoding="utf-8"))
        candidates = [json.loads((args.results / f"{call_id}.{a}.json").read_text(encoding="utf-8")) for a in base.ANGLES]
        payload = {"transcript": rows, "candidates": [{"angle": c["angle"], "result": c["result"],
                   "mechanical_validation_errors": c["validation_errors"]} for c in candidates],
                   "playbook_for_execution_only": version["content"]}
        result, metadata = base.infer(token, "@cf/openai/gpt-oss-120b", SYSTEM, json.dumps(payload), max_tokens=8500)
        by_id = {r["turn_id"]: r for r in rows}
        errors = []
        if {a.get("angle") for a in result.get("angles", [])} != set(base.ANGLES):
            errors.append("missing or invalid angles")
        for a in result.get("angles", []):
            for f in a.get("findings", []):
                ids = f.get("turn_ids", [])
                if not ids or any(i not in by_id for i in ids):
                    errors.append(f"invalid turn ids in {a.get('angle')}")
                f["source_evidence"] = [by_id[i] for i in ids if i in by_id]
        record = {"version": "six-angle-evidence-audit-v1", "call_id": call_id,
                  "metadata": metadata, "validation_errors": errors, "result": result,
                  "note": "Same-model review plus mechanical source hydration; requires human semantic review."}
        (args.results / f"{call_id}.audit.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
        print(json.dumps({"call_id": call_id, "errors": errors, "rejected_claims": len(result.get("rejected_claims", [])),
                          "verdict": result.get("combined_verdict")}), flush=True)


if __name__ == "__main__":
    main()

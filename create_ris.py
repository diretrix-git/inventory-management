import sys
import subprocess
from datetime import date

try:
    import pandas as pd
except Exception:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pandas', 'openpyxl', '--quiet'])
    import pandas as pd

out_path = r"C:\Users\Krish\OneDrive\Desktop\inventoryManagement\risk_register.xlsx"

risks = [
    { 'Risk ID':'R1', 'Risk':'Scope creep / requirements change', 'Category':'Scope', 'Probability':'50%', 'Impact':'High', 'Mitigation':'Change control; defined acceptance criteria; stakeholder sign-off; backlog grooming', 'Contingency':'Freeze scope or re-schedule features; sponsor escalation', 'Description':'Uncontrolled changes to scope lead to schedule and cost overruns', 'Status':'Active - change-control in place' },
    { 'Risk ID':'R2', 'Risk':'Requirements ambiguity', 'Category':'Requirements', 'Probability':'45%', 'Impact':'High', 'Mitigation':'Refine user stories; acceptance tests; continuous stakeholder clarification', 'Contingency':'Schedule clarification spike; defer unclear items', 'Description':'Poorly defined requirements cause rework and defects', 'Status':'Monitoring - clarification workshops planned' },
    { 'Risk ID':'R3', 'Risk':'Stakeholder priority shifts', 'Category':'Stakeholder', 'Probability':'40%', 'Impact':'Medium-High', 'Mitigation':'Governance board; prioritized backlog; regular demos', 'Contingency':'Re-plan release scope; negotiate minimum viable features', 'Description':'Changing business priorities disrupt roadmap', 'Status':'Monitored - governance scheduled' },
    { 'Risk ID':'R4', 'Risk':'Vendor / third-party failure', 'Category':'Vendor', 'Probability':'25%', 'Impact':'High', 'Mitigation':'Vendor SLAs; backup vendors; contractual penalties; integration tests', 'Contingency':'Switch provider or local workaround; escalate contract', 'Description':'Critical third-party service becomes unavailable or unsupported', 'Status':'Controls defined' },
    { 'Risk ID':'R5', 'Risk':'API / integration incompatibility', 'Category':'Technical', 'Probability':'40%', 'Impact':'Medium-High', 'Mitigation':'Early prototyping; contract tests; mocks; CI integration tests', 'Contingency':'Adapter layer; delay dependent features', 'Description':'Integrations fail due to mismatched contracts or versions', 'Status':'Spike planned' },
    { 'Risk ID':'R6', 'Risk':'Data quality / integrity issues', 'Category':'Data', 'Probability':'35%', 'Impact':'High', 'Mitigation':'Validation rules; ETL checks; data profiling; CI data tests', 'Contingency':'Data cleansing job; hold releases that rely on bad data', 'Description':'Incorrect or inconsistent data leads to wrong business outcomes', 'Status':'Monitoring - profiling scheduled' },
    { 'Risk ID':'R7', 'Risk':'Security vulnerability / data breach', 'Category':'Security', 'Probability':'20%', 'Impact':'Critical', 'Mitigation':'Secure design; encryption; IAM; pen testing; logging/alerts', 'Contingency':'Incident response plan; breach notification; forensics', 'Description':'Unauthorized access or exfiltration of sensitive data', 'Status':'Controls implemented; monitoring active' },
    { 'Risk ID':'R8', 'Risk':'Regulatory / compliance change', 'Category':'Compliance', 'Probability':'15%', 'Impact':'High', 'Mitigation':'Regulatory monitoring; legal reviews; configurable controls', 'Contingency':'Compliance remediation sprint; notify stakeholders', 'Description':'New laws or regulations require product changes', 'Status':'Watched - legal subscribed' },
    { 'Risk ID':'R9', 'Risk':'Performance / scalability limitations', 'Category':'Performance', 'Probability':'30%', 'Impact':'High', 'Mitigation':'Load testing; capacity planning; architectural reviews', 'Contingency':'Scale-up infra; optimize code; delay ramp-up', 'Description':'System cannot meet expected load or latency', 'Status':'Load tests scheduled' },
    { 'Risk ID':'R10', 'Risk':'Infrastructure / cloud outage', 'Category':'Infrastructure', 'Probability':'10%', 'Impact':'High', 'Mitigation':'Multi-AZ/region deployments; redundancy; failover tests', 'Contingency':'Failover to standby region; incident runbook', 'Description':'Cloud or hosting provider outage disrupts service', 'Status':'Redundancy in design' },
    { 'Risk ID':'R11', 'Risk':'Deployment pipeline failure', 'Category':'DevOps', 'Probability':'25%', 'Impact':'Medium', 'Mitigation':'Pipeline health checks; blue/green or canary; rollback scripts', 'Contingency':'Manual deploy procedures; hotfix branches', 'Description':'CI/CD failures prevent safe deployments', 'Status':'Pipeline monitoring active' },
    { 'Risk ID':'R12', 'Risk':'Insufficient automated testing', 'Category':'Quality', 'Probability':'35%', 'Impact':'High', 'Mitigation':'Increase unit/integration/e2e coverage; test gates in CI', 'Contingency':'Introduce stricter QA cycles; hold release if critical bugs appear', 'Description':'Lack of tests increases defect escape to production', 'Status':'Test coverage improvement plan' },
    { 'Risk ID':'R13', 'Risk':'Legacy system constraints', 'Category':'Legacy', 'Probability':'30%', 'Impact':'Medium-High', 'Mitigation':'Interface adapters; encapsulation; compatibility layers', 'Contingency':'Refactor or isolate legacy components', 'Description':'Old systems limit new feature implementations', 'Status':'Mitigation architecture drafted' },
    { 'Risk ID':'R14', 'Risk':'Third-party dependency breaking change', 'Category':'Dependency', 'Probability':'30%', 'Impact':'Medium', 'Mitigation':'Pin versions; scheduled dependency updates; integration tests', 'Contingency':'Patch or fork dependency; upgrade plan', 'Description':'Library or SDK update breaks functionality', 'Status':'Dependency policy enacted' },
    { 'Risk ID':'R15', 'Risk':'License or cost increases', 'Category':'Financial', 'Probability':'20%', 'Impact':'Medium', 'Mitigation':'Budget buffer; re-evaluate alternatives; negotiate terms', 'Contingency':'Reduce consumption; switch vendors', 'Description':'Licensing or cloud costs rise unexpectedly', 'Status':'Budget monitoring active' },
    { 'Risk ID':'R16', 'Risk':'Insufficient budget/funding cuts', 'Category':'Financial', 'Probability':'15%', 'Impact':'High', 'Mitigation':'Prioritized roadmap; MVP focus; cost forecasts', 'Contingency':'Scope reduction; seek additional funding', 'Description':'Project funding reduced impacting deliveries', 'Status':'Roadmap prioritized' },
    { 'Risk ID':'R17', 'Risk':'Optimistic estimation / schedule slippage', 'Category':'Schedule', 'Probability':'40%', 'Impact':'Medium-High', 'Mitigation':'Time buffers; decomposition; velocity tracking', 'Contingency':'Re-plan releases; negotiate dates', 'Description':'Tasks take longer than estimated, slipping schedule', 'Status':'Velocity monitored' },
    { 'Risk ID':'R18', 'Risk':'Inadequate monitoring & observability', 'Category':'Ops', 'Probability':'35%', 'Impact':'Medium-High', 'Mitigation':'Implement tracing, metrics, alerts, runbooks', 'Contingency':'Add temporary logging; increase telemetry retention', 'Description':'Lack of visibility delays detection and resolution', 'Status':'Observability backlog created' },
    { 'Risk ID':'R19', 'Risk':'Configuration management errors', 'Category':'Ops', 'Probability':'25%', 'Impact':'Medium', 'Mitigation':'Immutable infrastructure; config as code; reviews', 'Contingency':'Roll back configs; controlled change windows', 'Description':'Wrong configuration causes outages or data loss', 'Status':'IaC and review enforced' },
    { 'Risk ID':'R20', 'Risk':'Environment drift (dev/stage/prod)', 'Category':'Ops', 'Probability':'30%', 'Impact':'Medium', 'Mitigation':'Use container images; identical infra as code; smoke tests', 'Contingency':'Recreate environment; freeze deployments until fixed', 'Description':'Differences across environments cause unexpected failures', 'Status':'Environment standardization in progress' },
    { 'Risk ID':'R21', 'Risk':'Low user adoption / usability issues', 'Category':'User', 'Probability':'30%', 'Impact':'Medium', 'Mitigation':'Usability testing; early user feedback; analytics', 'Contingency':'UX improvements; adoption campaigns', 'Description':'Users do not adopt the product, reducing value', 'Status':'User testing planned' },
    { 'Risk ID':'R22', 'Risk':'Data migration errors', 'Category':'Data', 'Probability':'20%', 'Impact':'High', 'Mitigation':'Migration dry-runs; validation checks; backups', 'Contingency':'Rollback to backup; manual remediation', 'Description':'Migration corrupts or loses data during transfer', 'Status':'Migration plan and tests prepared' },
    { 'Risk ID':'R23', 'Risk':'Backup / disaster recovery failure', 'Category':'DR', 'Probability':'15%', 'Impact':'Critical', 'Mitigation':'Automated backups; restore drills; offsite copies', 'Contingency':'Invoke disaster recovery playbook', 'Description':'Backups fail or cannot be restored when needed', 'Status':'DR drills scheduled' },
    { 'Risk ID':'R24', 'Risk':'Intellectual property / licensing dispute', 'Category':'Legal', 'Probability':'10%', 'Impact':'High', 'Mitigation':'Legal review; indemnities in contracts; provenance checks', 'Contingency':'Cease contested features; legal action', 'Description':'IP claims or licensing conflicts disrupt delivery', 'Status':'Legal review available' },
    { 'Risk ID':'R25', 'Risk':'Security misconfiguration (IAM, S3, etc.)', 'Category':'Security', 'Probability':'22%', 'Impact':'High', 'Mitigation':'Automated config scanning; least privilege; audit logs', 'Contingency':'Revoke keys; apply correct policies; incident response', 'Description':'Incorrect security settings expose data or services', 'Status':'Config scanning enabled' },
]

register_rows = []
for r in risks:
    register_rows.append({
        'Risk ID': r['Risk ID'],
        'Risk': r['Risk'],
        'Category': r['Category'],
        'Probability': r['Probability'],
        'Impact': r['Impact'],
        'RMMM': r['Mitigation']
    })

df_register = pd.DataFrame(register_rows)

# write Excel with one sheet per RIS
with pd.ExcelWriter(out_path, engine='openpyxl') as writer:
    df_register.to_excel(writer, sheet_name='Risk Register', index=False)
    today = date.today().isoformat()
    for r in risks:
        # create a safe sheet name
        base = f"{r['Risk ID']}_{r['Risk']}"
        safe = base.replace('/', '-').replace(':', '-').replace('\\', '-').replace('?', '').replace('*','')
        sheet_name = safe[:31]
        meta = pd.DataFrame([{ 'Risk ID': r['Risk ID'], 'Date': today, 'Probability': r['Probability'], 'Impact': r['Impact'] }])
        rows = [
            ('Description', r['Description']),
            ('Refinement / Context', r.get('Context', '')), 
            ('Mitigation / Monitoring', r['Mitigation']),
            ('Management / Contingency plan / Triggers', r['Contingency']),
            ('Current status', r['Status'])
        ]
        df_rows = pd.DataFrame(rows, columns=['Field', 'Details'])
        meta.to_excel(writer, sheet_name=sheet_name, index=False, startrow=0)
        df_rows.to_excel(writer, sheet_name=sheet_name, index=False, startrow=4)

print(f"Wrote: {out_path}")

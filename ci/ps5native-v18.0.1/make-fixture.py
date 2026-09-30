from pathlib import Path
import json,argparse
ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);a=ap.parse_args();r=Path(a.root);r.mkdir(parents=True,exist_ok=True)
for n in ['CMakeLists.txt','PS5-CHECKPOINT.md','ANYPS5-AUDIT-20260929.md','README.md','RUN-DAKAR-v18.0.1.cmd','TEST.cmd','project.json']:(r/n).write_text('{}' if n=='project.json' else 'x',encoding='utf-8')
t=r/'tools';t.mkdir()
(t/'run-v18.0.1-final.ps1').write_text('01-build-windows 02-canonical-reconciliation 03-big-pass-core 04-real-dakar-frontier 05-package-cleanliness-final',encoding='utf-8')
(t/'reconcile-state-v18.0.py').write_text("MARKERS='remaining_unresolved_count eboot_table_index VALIDATED_EKPFS_GATE roadmap_credit'\\n",encoding='utf-8')
(t/'frontier-report-v18.0.py').write_text("MARKERS='naps-fidx-decode eboot-plaintext-extraction real-guest-entry visible-menu-gameplay roadmap_credit_awarded'\\n",encoding='utf-8')
(t/'real-dakar-big-pass-v18.0.ps1').write_text('dakar-ekpfs-intake-gate-v13.5.py dakar-final-retail-attempt-v16.0.2.ps1 frontier-report-v18.0.py dakar-pc-loose-playgo-attempt-v17.4.ps1 zero roadmap credit',encoding='utf-8')
(t/'ps5-runtime-provenance-audit-v17.3.py').write_text("MARKERS='FORBIDDEN Dakar2Game-Win64-Shipping.exe pc_binary_dependency_allowed pc_payload_copy_allowed'\\n",encoding='utf-8')
(t/'selftest-pc-only-unlock-v17.0.ps1').write_text(Path('ci/ps5native-v18.0.1/selftest-pc-only-unlock-v17.0.ps1').read_text(),encoding='utf-8')
e=r/'evidence/ps5';e.mkdir(parents=True);(e/'v18.0.1-github-windows-proof.json').write_text('{}')
u=e/'user/real-v18.0';u.mkdir(parents=True);(u/'dakar-real-frontier-v18.0.json').write_text('{}')
print('V1801_FIXTURE_READY')

import subprocess
from pathlib import Path

project_root = Path(__file__).resolve().parent
output_path = project_root / 'arena_logic_test_output.txt'

result = subprocess.run(
    ['node', 'src/lib/arenaLogic.test.mjs'],
    cwd=project_root,
    capture_output=True,
    text=True,
)

output = result.stdout + result.stderr
output_path.write_text(output, encoding='utf-8')
print('WROTE', output_path)
print('RETURN_CODE', result.returncode)
print('LAST_LINES:')
for line in output.strip().splitlines()[-20:]:
    print(line)

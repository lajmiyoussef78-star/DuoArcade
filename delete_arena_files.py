from pathlib import Path
import shutil

root = Path(__file__).resolve().parent / 'src'
paths = [
    root / 'lib' / 'arena.js',
    root / 'lib' / 'arenaLogic.js',
    root / 'lib' / 'arenaLogic.test.mjs',
    root / 'pages' / 'Arena.jsx',
    root / 'pages' / 'Match.jsx',
    root / 'styles' / 'arena.css'
]
results = []
for p in paths:
    try:
        if p.exists():
            p.unlink()
            results.append(f'deleted {p}')
        else:
            results.append(f'missing {p}')
    except Exception as e:
        results.append(f'error {p} {e}')
folder = root / 'games2v2'
try:
    if folder.exists():
        shutil.rmtree(folder)
        results.append(f'deleted folder {folder}')
    else:
        results.append(f'folder missing {folder}')
except Exception as e:
    results.append(f'error folder {folder} {e}')
status_path = Path(__file__).resolve().parent / 'delete_arena_files_result.txt'
status_path.write_text('\n'.join(results), encoding='utf-8')

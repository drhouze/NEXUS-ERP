#!/usr/bin/env python3
"""Replace hardcoded $${v/1000}k tick formatters with formatCurrencyAxisK(v)
and add the import to each affected file."""
import re
import sys

FILES = [
    'src/components/erp/dashboard.tsx',
    'src/components/erp/hr.tsx',
    'src/components/erp/finance.tsx',
    'src/components/erp/reports.tsx',
    'src/components/erp/purchasing.tsx',
]

OLD_PATTERN = r"tickFormatter=\{\(v\) => `\$\$\{v / 1000\}k`\}"
NEW_EXPR = "tickFormatter={formatCurrencyAxisK}"

# Match any existing import line from './lib' so we can extend it.
LIB_IMPORT_RE = re.compile(r"from '\./lib'")

for path in FILES:
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    new_src, count = re.subn(OLD_PATTERN, NEW_EXPR, src)
    if count == 0:
        print(f"{path}: no matches")
        continue

    # Add formatCurrencyAxisK to the existing './lib' import if not already there.
    if 'formatCurrencyAxisK' not in new_src:
        # Find the ./lib import line(s) and append formatCurrencyAxisK to the first one.
        def add_to_import(m):
            line = m.group(0)
            # If the import is a single-line `import { X } from './lib'`, extend the braces.
            # Match: import { X, Y } from './lib'
            single = re.match(r"import \{([^}]*)\} from '\./lib'", line)
            if single:
                names = single.group(1).strip()
                if names:
                    new_names = names + ', formatCurrencyAxisK'
                else:
                    new_names = 'formatCurrencyAxisK'
                return f"import {{ {new_names} }} from './lib'"
            return line
        new_src = LIB_IMPORT_RE.sub(add_to_import, new_src, count=1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_src)
    print(f"{path}: replaced {count} occurrences + added import")

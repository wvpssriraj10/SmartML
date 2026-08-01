import os
import re

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'src')


def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix: import * from "react" -> import * as React from "react"
    content = re.sub(r'import \*\s+from\s+["\']react["\']', 'import * as React from "react"', content)

    # Fix: import { Route } from './routes/__root' and similar aliased imports
    # These were originally `import { X as Y } from '...'` and lost the alias
    content = re.sub(
        r'import\s*\{\s*(Route|IndexRouteImport)\s*\}\s*from\s*[\'"](\./routes/(?:__root|index))[\'"]',
        r'import { Route as \1 } from \'\2\'',
        content
    )

    # Remove leftover interface/type junk: lines that start with incomplete interface/type/extends
    lines = content.split('\n')
    new_lines = []
    skip_until_bracket = 0
    for line in lines:
        stripped = line.strip()

        # Skip lines that are leftovers from interface/type declarations
        if re.match(r'^(extends|asChild\?|declare module|export interface|interface)\b', stripped):
            continue
        if stripped == '}' and skip_until_bracket > 0:
            skip_until_bracket -= 1
            continue
        if skip_until_bracket > 0:
            skip_until_bracket -= 1
            continue
        if re.match(r'^.*?extends\s+React\.\w+<[^>]*>', stripped):
            skip_until_bracket = 1
            continue
        if stripped.startswith('as any'):
            continue

        # Remove declare module blocks
        if 'declare module' in stripped:
            skip_until_bracket = 2
            continue

        # Remove generic type params from function calls like _addFileTypes<FileRouteTypes>()
        line = re.sub(r'(_addFileTypes|satisfies)\s*<[^>]+>\s*', r'\1 ', line)

        # Remove : Type from function parameters: ({ children }: { children }) -> ({ children })
        line = re.sub(r'(\{[^}]*\})\s*:\s*\{[^}]*\}', r'\1', line)

        # Remove : Type from destructured props: function X({ ... }: { ... })
        line = re.sub(r'\)\s*:\s*\{[^}]*\}\s*\{', r') {', line)

        # Fix leftover TypeScript in import { X } statements
        # Remove , type VariantProps etc leftovers
        line = re.sub(r',\s*type\s+\w+', '', line)
        line = re.sub(r'\btype\s+\w+,', '', line)

        # Remove `: string` `: number` etc from function params and variables
        line = re.sub(r'(\(\s*(?:readonly\s+)?\w+(?:\s*,\s*)?):\s*(?:string|number|boolean|void|null|undefined|any|\w+(?:\[\])?|React\.\w+)\s*(?=[,)])', r'\1', line)

        # Remove `: string` from simple variable assignments - pattern: `content: string) =>`
        line = re.sub(r'(\w+):\s*(string|number|boolean|void)\s*(\)|[=-])', r'\1\2', line)

        new_lines.append(line)

    content = '\n'.join(new_lines)

    # Post-cleanup: remove multiple blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def rewrite_special_files():
    route_tree = os.path.join(SRC, 'routeTree.gen.js')
    route_tree_content = """import { Route as rootRouteImport } from './routes/__root.jsx';
import { Route as IndexRouteImport } from './routes/index.jsx';

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
});

const rootRouteChildren = {
  IndexRoute: IndexRoute,
};

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren);
"""
    with open(route_tree, 'w', encoding='utf-8') as f:
        f.write(route_tree_content)
    print(f"  Rewrote: {os.path.relpath(route_tree, ROOT)}")

    # Fix __root.jsx - remove legacy error reporting references
    root_file = os.path.join(SRC, 'routes', '__root.jsx')
    if os.path.exists(root_file):
        with open(root_file, 'r', encoding='utf-8') as f:
            content = f.read()
        content = re.sub(r'import.*error-reporting.*\n', '', content)
        content = re.sub(r'report.*Error\([^)]*\);\s*\n', '', content)
        # Remove error import
        content = re.sub(r', useEffect, type ReactNode', ', useEffect', content)
        with open(root_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Cleaned error reporting refs: {os.path.relpath(root_file, ROOT)}")


def remove_unused_ui():
    ui_dir = os.path.join(SRC, 'components', 'ui')
    if os.path.exists(ui_dir):
        import shutil
        shutil.rmtree(ui_dir)
        print(f"  Removed unused UI components: {os.path.relpath(ui_dir, ROOT)}")


if __name__ == "__main__":
    print("Fixing converted files...")
    fixed = 0
    for root, dirs, files in os.walk(SRC):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js'):
                filepath = os.path.join(root, file)
                if fix_file(filepath):
                    fixed += 1
                    print(f"  Fixed: {os.path.relpath(filepath, ROOT)}")

    print(f"\nFixed {fixed} files with issues")
    print("\nRewriting special files...")
    rewrite_special_files()
    remove_unused_ui()
    print("\nDone. Now installing dependencies...")

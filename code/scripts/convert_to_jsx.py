import os
import re
import shutil

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'src')

# Patterns for TypeScript  ->  JavaScript conversion

def convert_content(content, filepath):
    lines = content.split('\n')
    new_lines = []
    skip_next = False
    in_interface = False
    in_type_block = 0
    interface_buffer = []
    type_buffer = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        # Track interface blocks
        if re.match(r'^\s*export\s+interface\s+\w+', stripped) or re.match(r'^\s*interface\s+\w+', stripped):
            if '{' in stripped:
                if stripped.count('{') == stripped.count('}'):
                    continue
                in_interface = True
                interface_buffer = [line]
            continue
        if in_interface:
            interface_buffer.append(line)
            if '{' in line:
                pass
            if '}' in line:
                interface_buffer.append('')
                in_interface = False
                interface_buffer = []
            continue

        # Track type declarations
        if re.match(r'^\s*(export\s+)?type\s+\w+\s*=', stripped):
            if stripped.endswith(';') or stripped.endswith(',') or line.strip() == '':
                continue
            in_type_block = 1
            type_buffer = [line]
            continue
        if in_type_block > 0:
            type_buffer.append(line)
            if '{' in line:
                in_type_block += 1
            if '}' in line:
                in_type_block -= 1
                if in_type_block == 0:
                    in_type_block = 0
                    type_buffer = []
                    continue

        if skip_next:
            skip_next = False
            continue

        new_line = line

        # import type { X } from 'y'  ->  import { X } from 'y'
        new_line = re.sub(
            r'import\s+type\s*\{([^}]+)\}\s*from\s*[\'"]([^\'"]+)[\'"]',
            r'import {\1} from "\2"',
            new_line
        )

        # import { X, type Y } from 'z'  ->  import { X } from 'z'
        # import { type X, type Y }  ->  import {}

        # Remove type-only imports: `, type X` or `type X,` or `type X`
        new_line = re.sub(r',\s*type\s+\w+', '', new_line)
        new_line = re.sub(r'type\s+\w+\s*,', '', new_line)
        new_line = re.sub(r'\btype\s+(\w+)', lambda m: f'{m.group(1)}' if ',' not in m.group(0) else '', new_line)

        # Clean up empty imports like `import {} from 'x'`  ->  remove the whole line
        if re.match(r'^\s*import\s+\{\s*\}\s*from', new_line):
            new_line = ''

        # export type { X }  ->  remove
        if re.match(r'^\s*export\s+type\s*\{', stripped):
            new_line = ''

        # Remove `: Type` from destructured parameters in function args
        # Pattern: `({ ... }: Type)`  ->  `({ ... })`
        # Match inside parentheses: `{ ... }: Type` where Type is after closing brace
        new_line = re.sub(r'(\})\s*:\s*(?:React\.\w+|\w+(?:<[^>]*>)?)\s*(?=[,\)])', r'\1', new_line)

        # Remove generic type args from forwardRef, useState, useRef, etc.
        # React.forwardRef<Type1, Type2>(  ->  React.forwardRef(
        new_line = re.sub(r'(React\.forwardRef|forwardRef|React\.createRef|createRef)<[^>]+>', r'\1', new_line)
        new_line = re.sub(r'(useState|useRef|useCallback|useMemo|useEffect|useContext|useReducer)<[^>]+>', r'\1', new_line)
        new_line = re.sub(r'(useState|useRef|useCallback|useMemo|useEffect|useContext|useReducer)<[^>]+>\(', r'\1(', new_line)

        # Remove `as const` assertions
        new_line = re.sub(r'\s+as\s+const', '', new_line)

        # Remove `as Type` casts
        new_line = re.sub(r'\s+as\s+\w+(?:<[^>]*>)?', '', new_line)

        # Remove `: Type` from variable declarations
        # const x: Type =  ->  const x =
        new_line = re.sub(r'(const|let|var)\s+(\w+)\s*:\s*[\w<>\[\],\s|&]+?\s*=', r'\1 \2 =', new_line)

        # Remove `: Type` from function return types
        # function foo(): Type {
        new_line = re.sub(r'(function\s+\w+)\s*\([^)]*\)\s*:\s*[\w<>\[\],\s|]+?\s*\{', r'\1(...) {', new_line)

        # Arrow function return types: `(): Type =>`  ->  `() =>`
        new_line = re.sub(r'(\))\s*:\s*(?:Promise<[^>]+>|\w+(?:<[^>]+>)?)\s*(=>)', r'\1 \2', new_line)

        # Remove `satisfies` expressions
        new_line = re.sub(r'\s+satisfies\s+\w+(?:<[^>]*>)?', '', new_line)

        # Remove `<Type>` from createRootRouteWithContext<Type>()  ->  createRootRouteWithContext()
        new_line = re.sub(r'(createRootRouteWithContext|createRootRoute)<[^>]+>', r'\1', new_line)

        # Fix React.HTMLAttributes<...>  ->  just remove the generic
        new_line = re.sub(r'(React\.\w+)<[^>]+>', r'\1', new_line)

        # Remove `: ReactNode` etc from TypeScript in component props
        new_line = re.sub(r'children: ReactNode', 'children', new_line)
        new_line = re.sub(r': React\.ReactNode', '', new_line)
        new_line = re.sub(r': ReactNode', '', new_line)

        # Clean up empty lines from removed imports
        if new_line.strip() == '' and i > 0 and lines[i-1].strip() == '':
            continue

        new_lines.append(new_line)

    result = '\n'.join(new_lines)

    # Post-processing: clean up multiple blank lines
    result = re.sub(r'\n{3,}', '\n\n', result)

    # Clean up empty braces in imports
    result = re.sub(r'import\s+\{\s*\}\s+from\s+[\'"][^\'"]+[\'"];\s*\n', '', result)

    return result


def rename_and_convert():
    count = 0
    for root, dirs, files in os.walk(SRC):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                old_path = os.path.join(root, file)
                # Determine new extension
                new_ext = '.jsx' if file.endswith('.tsx') else '.js'
                new_name = file[:-3] + new_ext if file.endswith('.tsx') else file[:-3] + '.js'
                new_path = os.path.join(root, new_name)

                # Read, convert, write
                with open(old_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Skip generated files that need special handling
                if 'routeTree.gen' in file:
                    # For routeTree.gen, do basic rename but keep the content mostly intact
                    # Just remove type annotations
                    content = convert_content(content, old_path)
                elif 'error-capture' in file or 'error-reporting' in file:
                    # These files will be removed later
                    os.remove(old_path)
                    continue
                elif 'error-page' in file:
                    # Will be removed
                    os.remove(old_path)
                    continue
                else:
                    content = convert_content(content, old_path)

                with open(new_path, 'w', encoding='utf-8') as f:
                    f.write(content)

                os.remove(old_path)
                count += 1
                print(f"  Converted: {os.path.relpath(old_path, ROOT)}  ->  {os.path.relpath(new_path, ROOT)}")

    print(f"\nConverted {count} files")

    # Convert vite.config.ts
    vite_ts = os.path.join(ROOT, 'vite.config.ts')
    if os.path.exists(vite_ts):
        with open(vite_ts, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(vite_ts, 'w', encoding='utf-8') as f:
            f.write(content)
        os.rename(vite_ts, os.path.join(ROOT, 'vite.config.js'))


def cleanup_legacy_files():
    print("\nRemoving legacy-specific files...")

    files_to_remove = [
        os.path.join(SRC, 'lib', 'error-reporting.ts'),
        os.path.join(SRC, 'lib', 'error-capture.ts'),
        os.path.join(SRC, 'lib', 'error-page.ts'),
        os.path.join(SRC, 'server.ts'),
        os.path.join(SRC, 'start.ts'),
        os.path.join(ROOT, 'AGENTS.md'),
    ]

    for f in files_to_remove:
        # Also check for .js variants if already converted
        for ext in ['.ts', '.tsx', '.js', '.jsx']:
            base = os.path.splitext(f)[0]
            path = base + ext
            if os.path.exists(path):
                os.remove(path)
                print(f"  Removed: {os.path.relpath(path, ROOT)}")

    # Remove legacy error-reporting references from __root.tsx/jsx
    root_file = os.path.join(SRC, 'routes', '__root.jsx')
    if os.path.exists(root_file):
        with open(root_file, 'r', encoding='utf-8') as f:
            content = f.read()
        # Remove legacy error reporting import and usage
        content = re.sub(r'import.*error-reporting.*\n', '', content)
        content = re.sub(r'report.*Error\([^)]+\);\s*\n', '', content)
        with open(root_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Cleaned legacy refs from: {os.path.relpath(root_file, ROOT)}")

    print("Cleanup done.")


def rewrite_vite_config():
    print("\nRewriting vite.config.js...")
    vite_js = os.path.join(ROOT, 'vite.config.js')
    if os.path.exists(vite_js):
        new_config = """import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
"""
        with open(vite_js, 'w', encoding='utf-8') as f:
            f.write(new_config)
        print(f"  Rewrote: {os.path.relpath(vite_js, ROOT)}")


def update_package_json():
    print("\nUpdating package.json...")
    pkg_json = os.path.join(ROOT, 'package.json')
    if os.path.exists(pkg_json):
        with open(pkg_json, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove legacy package entry if present
        content = re.sub(r'"@[^"/]+/vite-tanstack-config":\s*"[^"]+"\s*,?\n?', '', content)
        content = content.replace(',\n    \n    ,', ',\n    ')
        content = content.replace(',\n    ,', ',')
        content = re.sub(r',\s*,', ',', content)

        with open(pkg_json, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Updated: {os.path.relpath(pkg_json, ROOT)}")


if __name__ == "__main__":
    print("=" * 60)
    print("Converting TypeScript to JavaScript")
    print("=" * 60)

    rename_and_convert()
    rewrite_vite_config()
    cleanup_legacy_files()
    update_package_json()

    print("\n" + "=" * 60)
    print("DONE. Run `npm install && npm run dev` to test.")
    print("=" * 60)

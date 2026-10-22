import re
p = 'src/lib/animations.ts'
t = open(p).read()

# 0) remove old guard helper first
t, k = re.subn(r"// ---- fight idle \(guard\)\nconst guard = .*?\n\};\n", "", t, flags=re.S)
assert k == 1, 'guard'

# 1) remove old blocks
names = ['sat_sri_akal', 'wave', 'salute', 'clap', 'cry', 'angry', 'eat', 'drink_chai', 'giddha', 'fight_idle', 'punch', 'kick', 'block', 'victory', 'pray', 'point', 'laugh']
for n in names:
    pat = re.compile(r"(?:// ---- [^\n]*\n)?def\(\{\n  name: '" + n + r"'.*?\n\}\);\n\n?", re.S)
    t, k = pat.subn('', t)
    assert k == 1, (n, k)

helper = open('tools/helper.ts.txt').read()
t = t.replace("const legIK = (", helper + "\nconst legIK = (", 1)
new = open('tools/newclips.ts.txt').read()
t = t.replace("// ---- shrug", new + "// ---- shrug", 1)
open(p, 'w').write(t)

# prop tweaks
p = 'src/lib/props.ts'
t = open(p).read()
t = t.replace("g.add(mesh(new THREE.CylinderGeometry(0.15 * s, 0.12 * s, 0.025 * s, 18), mat('#cfd5dc', 0.25, 0.9), [m * -0.02 * s, -0.07 * s, 0.04 * s], [0, 0, 0]));",
              "g.add(mesh(new THREE.CylinderGeometry(0.15 * s, 0.12 * s, 0.025 * s, 18), mat('#cfd5dc', 0.25, 0.9), [m * -0.04 * s, -0.08 * s, 0.0], [0, 0, Math.PI / 2 * m]));")
t = t.replace("g.add(mesh(new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.02 * s, 10), mat(c, 0.8), [m * (-0.02 + x) * s, -0.052 * s, (0.04 + z) * s]));",
              "g.add(mesh(new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.02 * s, 10), mat(c, 0.8), [m * -0.056 * s, (-0.08 + x) * s, z * s], [0, 0, Math.PI / 2 * m]));")
t = re.sub(r"case 'chai': \{.*?break;\n    \}", """case 'chai': {
      g.add(mesh(new THREE.CylinderGeometry(0.036 * s, 0.03 * s, 0.1 * s, 12, 1, true), mat('#cfd5dc', 0.25, 0.9), [m * -0.01 * s, -0.05 * s, 0.0], [Math.PI / 2, 0, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.034 * s, 0.034 * s, 0.004 * s, 12), mat('#9a5a2a', 0.5), [m * -0.01 * s, -0.05 * s, 0.04 * s], [Math.PI / 2, 0, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.004 * s, 12), mat('#cfd5dc', 0.25, 0.9), [m * -0.01 * s, -0.05 * s, -0.05 * s], [Math.PI / 2, 0, 0]));
      break;
    }""", t, flags=re.S)
open(p, 'w').write(t)
print('patched')

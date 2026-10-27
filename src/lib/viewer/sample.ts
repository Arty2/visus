import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	PerspectiveCamera,
	Vector3
} from 'three';

// A small invented pavilion, built in code rather than shipped as a file:
// nothing to download, nothing traceable to anyone's real project, and it
// carries named cameras the way a SketchUp scene export would, so every
// control has something to act on before anyone has a model to hand.

export const SAMPLE_NAME = 'Sample pavilion';

export function buildSample(): Group {
	const root = new Group();
	root.name = SAMPLE_NAME;

	const stone = new MeshStandardMaterial({ color: 0xd9d2c5, roughness: 0.9 });
	const timber = new MeshStandardMaterial({ color: 0x9a6b44, roughness: 0.7 });
	const roof = new MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.6 });
	const leaf = new MeshStandardMaterial({ color: 0x5f7f4f, roughness: 1 });
	const grass = new MeshStandardMaterial({ color: 0xb7c4a0, roughness: 1 });

	const box = (
		w: number,
		h: number,
		d: number,
		m: MeshStandardMaterial,
		x: number,
		y: number,
		z: number
	) => {
		const mesh = new Mesh(new BoxGeometry(w, h, d), m);
		mesh.position.set(x, y + h / 2, z);
		root.add(mesh);
		return mesh;
	};

	box(30, 0.05, 30, grass, 0, -0.05, 0); // the ground it stands on
	box(12, 0.45, 8, stone, 0, 0, 0); // plinth

	// Three steps up to the plinth, on its south side.
	for (let i = 0; i < 3; i++)
		box(3, 0.15 * (i + 1), 0.35, stone, 0, 0, 4.0 + 0.35 * (2 - i) + 0.175);

	// Columns on a 3.6 m grid, and a thin roof slab over them.
	for (const x of [-5.4, -1.8, 1.8, 5.4]) {
		for (const z of [-3.4, 3.4]) {
			const column = new Mesh(new CylinderGeometry(0.16, 0.16, 3.2, 20), timber);
			column.position.set(x, 0.45 + 1.6, z);
			root.add(column);
		}
	}
	box(13, 0.25, 9, roof, 0, 3.65, 0);

	// A back wall to stand against, and a bench along it.
	box(7, 2.4, 0.2, stone, 0, 0.45, -3.6);
	box(4, 0.45, 0.45, timber, 0, 0.45, -3.1);

	// Two trees off the corners.
	for (const [x, z] of [
		[-9, -6],
		[9.5, 5]
	]) {
		const trunk = new Mesh(new CylinderGeometry(0.15, 0.2, 1.6, 10), timber);
		trunk.position.set(x, 0.8, z);
		const crown = new Mesh(new ConeGeometry(1.4, 3.6, 14), leaf);
		crown.position.set(x, 3.2, z);
		root.add(trunk, crown);
	}

	// Named cameras at eye height, as an exporter would leave them.
	const camera = (name: string, at: [number, number, number], look: [number, number, number]) => {
		const node = new Object3D();
		node.name = name;
		const cam = new PerspectiveCamera(60);
		node.position.set(...at);
		root.add(node);
		node.add(cam);
		node.lookAt(new Vector3(...look));
		// lookAt turns a plain node's +Z to the target, and a camera looks
		// down its −Z: half a turn puts the lens on the subject.
		node.rotateY(Math.PI);
	};
	camera('skp_camera_Approach', [0, 1.6, 13], [0, 1.8, 0]);
	camera('skp_camera_Under_the_roof', [3.6, 0.45 + 1.6, 1.5], [-4, 1.6, -2]);
	camera('skp_camera_Bench', [0, 0.45 + 1.2, -2.6], [0, 1.4, 6]);

	return root;
}

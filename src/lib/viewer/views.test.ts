import { describe, expect, it } from 'vitest';
import { Group, Matrix4, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { camerasIn, cleanCameraName, viewFromMatrix } from './views';

describe('cleanCameraName', () => {
	it('reads SketchUp scene cameras as their scene names', () => {
		expect(cleanCameraName('skp_camera_Front_Entrance', 'x')).toBe('Front Entrance');
		expect(cleanCameraName('skp_camera_Last_Saved_SketchUp_View', 'x')).toBe(
			'Last Saved SketchUp View'
		);
	});

	it('falls back when there is nothing to read', () => {
		expect(cleanCameraName('', 'Camera 3')).toBe('Camera 3');
		expect(cleanCameraName('__', 'Camera 3')).toBe('Camera 3');
	});
});

describe('viewFromMatrix', () => {
	it('reads position, yaw and pitch from a camera looking somewhere', () => {
		const camera = new PerspectiveCamera();
		camera.position.set(1, 2, 3);
		camera.lookAt(new Vector3(1 - 1, 2 - 1, 3)); // left (−X) and down 45°
		camera.updateMatrixWorld();
		const view = viewFromMatrix(camera.matrixWorld);
		expect(view.position.toArray()).toEqual([1, 2, 3]);
		expect(view.yaw).toBeCloseTo(Math.PI / 2, 6);
		expect(view.pitch).toBeCloseTo(-Math.PI / 4, 6);
	});
});

describe('camerasIn', () => {
	it('finds cameras nested anywhere, in model coordinates, named by their node', () => {
		// The root's own transform counts (Collada puts unit scale and Z-up
		// there); its parent's does not, because that's the viewer's.
		const holder = new Group();
		holder.applyMatrix4(new Matrix4().makeTranslation(100, 0, 0));
		const root = new Group();
		root.scale.setScalar(0.0254);
		holder.add(root);

		const node = new Object3D();
		node.name = 'skp_camera_Terrace';
		node.position.set(100, 50, 0);
		node.add(new PerspectiveCamera());
		root.add(node);

		const views = camerasIn(root);
		expect(views).toHaveLength(1);
		expect(views[0].name).toBe('Terrace');
		expect(views[0].position[0]).toBeCloseTo(2.54, 9);
		expect(views[0].position[1]).toBeCloseTo(1.27, 9);
		expect(views[0].saved).toBe(false);
	});

	it('tells apart cameras that share a name', () => {
		const root = new Group();
		for (let i = 0; i < 3; i++) {
			const c = new PerspectiveCamera();
			c.name = 'Cam';
			root.add(c);
		}
		expect(camerasIn(root).map((v) => v.name)).toEqual(['Cam', 'Cam 2', 'Cam 3']);
	});
});

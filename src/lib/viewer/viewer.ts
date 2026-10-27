import {
	ACESFilmicToneMapping,
	Box3,
	Sphere,
	Spherical,
	Vector4,
	BoxGeometry,
	BufferGeometry,
	Color,
	DirectionalLight,
	Float32BufferAttribute,
	GridHelper,
	Group,
	HemisphereLight,
	Line,
	LineBasicMaterial,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	PMREMGenerator,
	Quaternion,
	Raycaster,
	RingGeometry,
	Scene,
	Vector2,
	Vector3,
	WebGLRenderer,
	type Intersection,
	type Material,
	type Object3D,
	type Texture
} from 'three';
import CameraControls from 'camera-controls';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Annotation, Vec3 } from '$lib/store/notes';
import { autoShift, keyboardRows, pressKey } from './keyboard';
import { Markers } from './markers';
import { Panel, type Control } from './panel';
import {
	fitScale,
	forwardOf,
	placeFeet,
	placeHead,
	scaleLabel,
	snapScale,
	turnAboutHead,
	yawOf
} from './rig';
import type { ViewTarget } from './views';
import { hex } from './theme';

/**
 * What the viewer asks of the page. The viewer draws and handles input; the
 * page owns the data (src/lib/store), so every change to a note or a saved
 * viewpoint goes back through here rather than being kept in two places.
 */
export interface ViewerHooks {
	/** A note was placed at a point in model coordinates; returns its id. */
	addNote(position: Vec3): string;
	setNoteText(id: string, text: string): void;
	toggleNote(id: string): void;
	deleteNote(id: string): void;
	discardIfEmpty(id: string): void;
	saveView(position: Vec3, yaw: number): void;
	viewChanged(index: number): void;
	noteSelected(id: string): void;
	sessionChanged(active: boolean): void;
}

// camera-controls takes the three.js classes it needs rather than importing
// three itself, so it can never end up holding a second copy of them.
CameraControls.install({
	THREE: { Vector2, Vector3, Vector4, Quaternion, Matrix4, Spherical, Box3, Sphere, Raycaster }
});

const UP = new Vector3(0, 1, 0);
/** Animated moves on a screen — unless the person has asked for less motion. */
const animate = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const SNAP_TURN = Math.PI / 6;
/** Walking pace with the stick fully over, metres per second of the room. */
const MOVE_SPEED = 2;
const DEADZONE = 0.2;
/** The scales the menu offers besides Fit and 1:1. */
const MENU_SCALES = [1 / 20, 1 / 50, 1 / 100, 1 / 200];

// xr-standard gamepad mapping, as the Quest's Touch controllers report it.
// The trigger (0) isn't read here: it arrives as the select event, which is
// also what a pinch on a tracked hand sends.
const SQUEEZE = 1;
const STICK_X = 2;
const STICK_Y = 3;
const LOWER = 4; // A on the right, X on the left
const UPPER = 5; // B on the right, Y on the left

interface Hand {
	ray: Group;
	source: XRInputSource | null;
	line: Line;
	pressed: boolean[];
	/** Which way the stick was last pushed past the snap-turn threshold. */
	flick: -1 | 0 | 1;
	aiming: boolean;
}

type Hit =
	| { kind: 'panel'; panel: Panel; control: Control | null; distance: number }
	| { kind: 'note'; id: string; distance: number }
	| { kind: 'model'; point: Vector3; normal: Vector3; distance: number };

interface Editing {
	id: string;
	text: string;
	shift: boolean;
	isNew: boolean;
	done: boolean;
}

type Grab =
	| { mode: 'none' }
	| { mode: 'one'; hand: Hand; anchor: Vector3 }
	| {
			mode: 'two';
			start: Matrix4;
			scale: number;
			mid: Vector3;
			distance: number;
			angle: number;
	  };

export class Viewer {
	private readonly renderer: WebGLRenderer;
	private readonly scene = new Scene();
	private readonly camera: PerspectiveCamera;
	/** The play space: moved to move the person, since the headset owns the head. */
	private readonly dolly = new Group();
	/** The model's frame: scaled and placed for the overview, identity at 1:1. */
	private readonly world = new Group();
	private readonly controls: CameraControls;
	private readonly markers = new Markers();
	private readonly raycaster = new Raycaster();
	private readonly resizeObserver: ResizeObserver;
	private readonly hands: Hand[] = [];
	private readonly arc: Line;
	private readonly marker: Mesh;
	private readonly menu = new Panel(1024, 800, 0.52);
	private readonly keyboard = new Panel(1024, 684, 0.62);
	private readonly toast = new Panel(1024, 120, 0.36);
	private grid: GridHelper | null = null;

	private model: Object3D | null = null;
	private modelName = '';
	private readonly bounds = new Box3();
	/** `bounds` as placed this frame — a cheap first test before any mesh raycast. */
	private readonly worldBounds = new Box3();
	private targets: Object3D[] = [];
	private views: ViewTarget[] = [];
	private viewIndex = -1;
	private dollyYaw = 0;
	private pendingPlacement = false;
	private teleportTarget: { point: Vector3; onModel: boolean } | null = null;
	private grab: Grab = { mode: 'none' };
	private editing: Editing | null = null;
	private armedNote = false;
	private toastUntil = 0;
	private toastText = '';
	private lastTime = 0;
	private desktopPose: { position: Vector3; quaternion: Quaternion; target: Vector3 } | null = null;
	private addMode = false;
	private pointerDown: { x: number; y: number } | null = null;

	constructor(
		private readonly container: HTMLElement,
		private readonly hooks: ViewerHooks
	) {
		const renderer = new WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.toneMapping = ACESFilmicToneMapping;
		renderer.xr.enabled = true;
		// The floor of the room is y = 0 of the play space, so a teleport can
		// put it on a floor of the model and heights come out right.
		renderer.xr.setReferenceSpaceType('local-floor');
		this.renderer = renderer;
		const canvas = renderer.domElement;
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', '3D view of the model');
		canvas.tabIndex = 0;
		container.append(canvas);

		this.scene.background = new Color(hex.sky);
		const pmrem = new PMREMGenerator(renderer);
		this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		this.scene.environmentIntensity = 0.5;
		pmrem.dispose();
		this.scene.add(new HemisphereLight(0xffffff, 0x8d8a80, 1.4));
		const sun = new DirectionalLight(0xffffff, 1.6);
		sun.position.set(5, 10, 7);
		this.scene.add(sun);

		this.camera = new PerspectiveCamera(60, 1, 0.05, 2000);
		this.camera.position.set(8, 6, 10);
		this.dolly.add(this.camera);
		this.scene.add(this.dolly, this.world);
		this.world.add(this.markers.group);

		// camera-controls rather than three's OrbitControls: eased, animated
		// moves between views instead of jumps, zoom toward the cursor (the
		// way architecture is looked at — at a corner, not the middle), and
		// better trackpad and touch handling.
		this.controls = new CameraControls(this.camera, canvas);
		this.controls.dollyToCursor = true;
		this.controls.smoothTime = 0.35;
		canvas.addEventListener('keydown', (e) => this.desktopKey(e));

		this.arc = new Line(
			new BufferGeometry().setAttribute(
				'position',
				new Float32BufferAttribute(new Float32Array(3 * 64), 3)
			),
			new LineBasicMaterial({ color: hex.accent })
		);
		this.arc.frustumCulled = false;
		this.arc.visible = false;
		this.marker = new Mesh(
			new RingGeometry(0.18, 0.24, 32).rotateX(-Math.PI / 2),
			new MeshBasicMaterial({ color: hex.accent, depthTest: false })
		);
		this.marker.renderOrder = 6;
		this.marker.visible = false;
		this.scene.add(this.arc, this.marker);

		this.dolly.add(this.menu.mesh, this.keyboard.mesh);
		this.camera.add(this.toast.mesh);
		this.toast.mesh.position.set(0, -0.22, -0.75);

		for (let i = 0; i < 2; i++) this.hands.push(this.makeHand(i));

		renderer.xr.addEventListener('sessionstart', () => this.sessionStarted());
		renderer.xr.addEventListener('sessionend', () => this.sessionEnded());

		canvas.addEventListener('pointerdown', (e) => {
			this.pointerDown = { x: e.clientX, y: e.clientY };
		});
		canvas.addEventListener('pointerup', (e) => this.desktopClick(e));

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(container);
		this.resize();

		renderer.setAnimationLoop((time) => this.frame(time));
	}

	// ── What the page tells the viewer ─────────────────────────────────────

	setModel(root: Object3D | null, name = '') {
		if (this.model) {
			this.world.remove(this.model);
			dispose(this.model);
		}
		this.model = root;
		this.modelName = name;
		this.resetWorld();
		this.targets = [];
		this.bounds.makeEmpty();
		this.grid?.removeFromParent();
		this.grid?.dispose();
		this.grid = null;
		if (!root) return;

		this.world.add(root);
		root.updateMatrixWorld(true);
		this.bounds.setFromObject(root);
		root.traverse((o) => {
			if ((o as Mesh).isMesh && o.visible) this.targets.push(o);
		});

		const size = this.bounds.getSize(new Vector3());
		const center = this.bounds.getCenter(new Vector3());
		const extent = Math.max(size.x, size.y, size.z, 0.1);

		// A ground grid of 1 m squares, or 10 m ones under a site too large for
		// that to read as anything but grey.
		const span = Math.max(size.x, size.z) * 1.6 + 10;
		const cell = span > 300 ? 10 : 1;
		const cells = Math.min(400, Math.ceil(span / cell));
		this.grid = new GridHelper(cells * cell, cells, hex.gridMajor, hex.gridMinor);
		this.grid.position.set(center.x, this.bounds.min.y - 0.002, center.z);
		this.world.add(this.grid);

		this.camera.near = Math.max(0.01, extent / 5000);
		this.camera.far = Math.max(2000, extent * 20);
		this.camera.updateProjectionMatrix();

		this.viewIndex = -1;
		if (this.presenting) {
			this.overview();
		} else {
			// The desktop view starts outside the model, three-quarters on.
			const eye = center
				.clone()
				.addScaledVector(new Vector3(0.9, 0.6, 1).normalize(), extent * 1.4);
			void this.controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z, false);
		}
	}

	setViews(views: ViewTarget[]) {
		// Followed by id, not position: deleting a saved view above the
		// current one shifts every index after it.
		const current = this.views[this.viewIndex]?.id;
		this.views = views;
		this.viewIndex = current ? views.findIndex((v) => v.id === current) : -1;
	}

	setNotes(notes: Annotation[]) {
		this.markers.sync(notes);
		// A note deleted from the page while it's open on the keyboard.
		if (this.editing && !notes.some((n) => n.id === this.editing?.id)) this.closeEditor();
	}

	setAddMode(on: boolean) {
		this.addMode = on;
		this.renderer.domElement.classList.toggle('placing', on);
	}

	get presenting(): boolean {
		return this.renderer.xr.isPresenting;
	}

	/** Must be called from a click: the browser only starts VR on a gesture. */
	async enterVR(): Promise<void> {
		const xr = navigator.xr;
		if (!xr) throw new Error('This browser has no WebXR.');
		const session = await xr.requestSession('immersive-vr', {
			optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
		});
		await this.renderer.xr.setSession(session);
	}

	exitVR() {
		void this.renderer.xr.getSession()?.end();
	}

	goToView(index: number) {
		const view = this.views[index];
		if (!view) return;
		this.viewIndex = index;
		this.hooks.viewChanged(index);

		if (this.presenting) {
			this.resetWorld();
			this.placeHeadAt(new Vector3(...view.position), view.yaw);
			this.say(`${view.name}  ·  ${index + 1} of ${this.views.length}`);
			return;
		}

		// On a screen the camera can take the pitch too; in a headset only the
		// person's neck decides that.
		const eye = new Vector3(...view.position);
		const look = forwardOf(view.yaw)
			.multiplyScalar(Math.cos(view.pitch))
			.setY(Math.sin(view.pitch))
			.add(eye);
		void this.controls.setLookAt(eye.x, eye.y, eye.z, look.x, look.y, look.z, animate());
	}

	/** Where the desktop camera is, as a viewpoint worth saving. */
	currentView(): { position: Vec3; yaw: number } {
		const head = this.camera.getWorldPosition(new Vector3());
		return { position: this.toModel(head), yaw: this.headYaw() - yawOf(this.world.quaternion) };
	}

	dispose() {
		this.renderer.setAnimationLoop(null);
		this.resizeObserver.disconnect();
		this.setModel(null);
		this.controls.dispose();
		this.menu.dispose();
		this.keyboard.dispose();
		this.toast.dispose();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	// ── The frame ──────────────────────────────────────────────────────────

	private frame(time: number) {
		const dt = Math.min(0.1, Math.max(0, (time - this.lastTime) / 1000));
		this.lastTime = time;

		if (this.presenting) this.updateXR(dt, time);
		else this.controls.update(dt);

		this.markers.resize(this.camera.getWorldPosition(new Vector3()), this.world.scale.x);
		this.renderer.render(this.scene, this.camera);
	}

	private resize() {
		if (this.presenting) return;
		const { clientWidth: w, clientHeight: h } = this.container;
		if (!w || !h) return;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	// ── Desktop ────────────────────────────────────────────────────────────

	private desktopClick(e: PointerEvent) {
		const down = this.pointerDown;
		this.pointerDown = null;
		// A drag is orbiting, not pointing.
		if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;

		const rect = this.renderer.domElement.getBoundingClientRect();
		const ndc = new Vector2(
			((e.clientX - rect.left) / rect.width) * 2 - 1,
			-((e.clientY - rect.top) / rect.height) * 2 + 1
		);
		this.raycaster.setFromCamera(ndc, this.camera);
		const hit = this.hitScene();
		if (hit?.kind === 'note') this.hooks.noteSelected(hit.id);
		else if (hit?.kind === 'model' && this.addMode) {
			const id = this.hooks.addNote(this.toModel(hit.point));
			this.hooks.noteSelected(id);
		}
	}

	/** Arrows orbit, shift-arrows pan, + and − zoom: the canvas is focusable. */
	private desktopKey(e: KeyboardEvent) {
		if (this.presenting) return;
		const step = Math.PI / 24;
		const pan = this.controls.distance * 0.05;
		const smooth = animate();
		const moves: Record<string, () => unknown> = e.shiftKey
			? {
					ArrowLeft: () => this.controls.truck(-pan, 0, smooth),
					ArrowRight: () => this.controls.truck(pan, 0, smooth),
					ArrowUp: () => this.controls.truck(0, -pan, smooth),
					ArrowDown: () => this.controls.truck(0, pan, smooth)
				}
			: {
					ArrowLeft: () => this.controls.rotate(step, 0, smooth),
					ArrowRight: () => this.controls.rotate(-step, 0, smooth),
					ArrowUp: () => this.controls.rotate(0, step, smooth),
					ArrowDown: () => this.controls.rotate(0, -step, smooth)
				};
		moves['+'] = moves['='] = () => this.controls.dolly(this.controls.distance * 0.2, smooth);
		moves['-'] = () => this.controls.dolly(-this.controls.distance * 0.2, smooth);
		const move = moves[e.key];
		if (!move) return;
		e.preventDefault();
		move();
	}

	// ── Entering and leaving VR ────────────────────────────────────────────

	private sessionStarted() {
		this.desktopPose = {
			position: this.camera.position.clone(),
			quaternion: this.camera.quaternion.clone(),
			target: this.controls.getTarget(new Vector3())
		};
		this.controls.enabled = false;
		// Cleared so the first frame can tell the headset's pose has arrived:
		// left as it was, the orbit camera's position would pass for a head.
		this.camera.position.set(0, 0, 0);
		this.pendingPlacement = true;
		this.hooks.sessionChanged(true);
	}

	private sessionEnded() {
		// Taking the headset off mid-note keeps what was typed; a note placed
		// and never written in goes, as Cancel would have done.
		const e = this.editing;
		if (e?.text.trim()) this.hooks.setNoteText(e.id, e.text.trim());
		else if (e?.isNew) this.hooks.discardIfEmpty(e.id);
		this.closeEditor();
		this.menu.mesh.visible = false;
		this.arc.visible = false;
		this.marker.visible = false;
		this.grab = { mode: 'none' };
		this.dolly.position.set(0, 0, 0);
		this.dollyYaw = 0;
		this.dolly.rotation.set(0, 0, 0);
		this.resetWorld();
		if (this.desktopPose) {
			const { position: p, target: t } = this.desktopPose;
			this.camera.scale.set(1, 1, 1);
			void this.controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
		}
		this.controls.enabled = true;
		this.resize();
		this.hooks.sessionChanged(false);
	}

	// ── VR, every frame ────────────────────────────────────────────────────

	private updateXR(dt: number, time: number) {
		// The head's pose arrives with the first rendered frame; until then
		// there's nothing to place the model in front of.
		if (this.pendingPlacement && this.camera.position.y !== 0) {
			this.pendingPlacement = false;
			this.overview();
			this.openMenu();
		}

		if (this.toast.mesh.visible && time > this.toastUntil) this.toast.mesh.visible = false;

		this.world.updateMatrixWorld(true);
		this.worldBounds.copy(this.bounds).applyMatrix4(this.world.matrixWorld);

		const left = this.hands.find((h) => h.source?.handedness === 'left');
		const right = this.hands.find((h) => h.source?.handedness === 'right');

		let menuHover: string | null = null;
		let keyHover: string | null = null;
		for (const hand of this.hands) {
			if (!hand.source || hand.source.targetRayMode !== 'tracked-pointer') {
				hand.line.visible = false;
				continue;
			}
			hand.line.visible = !hand.aiming;
			// The model is tested for the pointing hand only: it's the costly
			// one, and the line's length is the only thing it's needed for here.
			const hit = this.pick(hand, hand === right || !right);
			hand.line.scale.z = hit ? Math.min(hit.distance, 20) : 5;
			if (hit?.kind === 'panel' && hit.control) {
				if (hit.panel === this.menu) menuHover = hit.control.id;
				else keyHover = hit.control.id;
			}
		}
		this.menu.setHover(menuHover);
		this.keyboard.setHover(keyHover);

		this.updateGrab();

		if (right) this.rightStick(right);
		if (left) this.leftStick(left, dt);

		if (right) {
			if (this.edge(right, LOWER)) this.stepView(1, right);
			if (this.edge(right, UPPER)) this.stepView(-1, right);
		}
		if (left) {
			if (this.edge(left, LOWER)) this.addNoteAtPointer(right ?? left);
			if (this.edge(left, UPPER)) this.toggleMenu();
		}
		for (const hand of this.hands) this.remember(hand);
	}

	private makeHand(index: number): Hand {
		const ray = this.renderer.xr.getController(index);
		const line = new Line(
			new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, 0, -1)]),
			new LineBasicMaterial({ color: hex.ray, transparent: true, opacity: 0.6 })
		);
		line.visible = false;
		ray.add(line);

		// No controller models: three.js would fetch them from a CDN, which the
		// security policy refuses, and a plain grip reads fine in the hand.
		const grip = this.renderer.xr.getControllerGrip(index);
		const handle = new Mesh(
			new BoxGeometry(0.03, 0.03, 0.11),
			new MeshBasicMaterial({ color: hex.grip })
		);
		handle.position.z = 0.02;
		grip.add(handle);
		this.dolly.add(ray, grip);

		const hand: Hand = { ray, source: null, line, pressed: [], flick: 0, aiming: false };
		ray.addEventListener('connected', (e) => {
			hand.source = (e as unknown as { data: XRInputSource }).data;
		});
		ray.addEventListener('disconnected', () => {
			hand.source = null;
			hand.line.visible = false;
		});
		// Trigger on a controller, pinch on a tracked hand: both arrive as select.
		ray.addEventListener('selectstart', () => this.select(hand));
		return hand;
	}

	private edge(hand: Hand, button: number): boolean {
		const pressed = !!hand.source?.gamepad?.buttons[button]?.pressed;
		return pressed && !hand.pressed[button];
	}

	private remember(hand: Hand) {
		const buttons = hand.source?.gamepad?.buttons ?? [];
		hand.pressed = buttons.map((b) => b.pressed);
	}

	// ── Pointing ───────────────────────────────────────────────────────────

	private pick(hand: Hand, withModel = true): Hit | null {
		const origin = hand.ray.getWorldPosition(new Vector3());
		const direction = new Vector3(0, 0, -1)
			.applyQuaternion(hand.ray.getWorldQuaternion(new Quaternion()))
			.normalize();
		this.raycaster.set(origin, direction);
		this.raycaster.camera = this.camera;

		// Panels are drawn over everything, so they win over anything nearer.
		for (const panel of [this.keyboard, this.menu]) {
			if (!panel.mesh.visible) continue;
			const [hit] = this.raycaster.intersectObject(panel.mesh, false);
			if (hit?.uv)
				return { kind: 'panel', panel, control: panel.at(hit.uv), distance: hit.distance };
		}
		return this.hitScene(withModel);
	}

	/** Notes first — they're drawn on top — then the model. */
	private hitScene(withModel = true): Hit | null {
		const [note] = this.raycaster.intersectObjects(this.markers.targets(), false);
		if (note)
			return { kind: 'note', id: note.object.userData.noteId as string, distance: note.distance };
		if (!withModel) return null;
		// Testing every mesh is the expensive part; a ray that misses the
		// model's box can't hit anything in it. (Empty bounds — no model, or
		// the desktop before the first XR frame — fall through to the full test.)
		if (this.presenting && !this.raycaster.ray.intersectsBox(this.worldBounds)) return null;
		const [hit] = this.raycaster.intersectObjects(this.targets, false);
		return hit ? modelHit(hit, this.raycaster.ray.direction) : null;
	}

	private select(hand: Hand) {
		const hit = this.pick(hand);
		if (hit?.kind === 'panel') {
			if (hit.control) {
				this.buzz(hand, 0.25, 15);
				this.press(hit.panel, hit.control.id);
			}
			return;
		}
		if (hit?.kind === 'note') {
			this.openEditor(hit.id, false);
			return;
		}
		if (hit?.kind === 'model' && this.armedNote) {
			this.armedNote = false;
			this.placeNote(hit.point);
			return;
		}
		// A tracked hand has no Y button; pinching at nothing opens the menu.
		if (!hit && !hand.source?.gamepad) this.toggleMenu();
	}

	private addNoteAtPointer(hand: Hand) {
		const hit = this.pick(hand);
		if (hit?.kind === 'model') {
			this.buzz(hand);
			this.placeNote(hit.point);
		} else {
			this.armedNote = true;
			this.say('Point at the model and pull the trigger to place a note');
		}
	}

	private placeNote(world: Vector3) {
		const id = this.hooks.addNote(this.toModel(world));
		this.openEditor(id, true);
	}

	// ── Moving ─────────────────────────────────────────────────────────────

	private leftStick(hand: Hand, dt: number) {
		const axes = hand.source?.gamepad?.axes;
		if (!axes) return;
		const x = deadzone(axes[STICK_X] ?? 0);
		const y = deadzone(axes[STICK_Y] ?? 0);
		if (!x && !y) return;
		// Head-relative and level: forward is where you look, never into the
		// floor, and strafing is sideways to that.
		const yaw = this.headYaw();
		const forward = forwardOf(yaw);
		const right = new Vector3().crossVectors(forward, UP);
		this.dolly.position
			.addScaledVector(forward, -y * MOVE_SPEED * dt)
			.addScaledVector(right, x * MOVE_SPEED * dt);
	}

	private rightStick(hand: Hand) {
		const axes = hand.source?.gamepad?.axes;
		if (!axes) return;
		const x = axes[STICK_X] ?? 0;
		const y = axes[STICK_Y] ?? 0;

		// Push forward to aim a teleport, let go to take it.
		if (y < -0.6 && Math.abs(x) < 0.7) hand.aiming = true;
		if (hand.aiming) {
			if (Math.hypot(x, y) < 0.3) {
				hand.aiming = false;
				this.arc.visible = false;
				this.marker.visible = false;
				if (this.teleportTarget) {
					this.buzz(hand, 0.5, 40);
					this.teleport(this.teleportTarget);
				}
				this.teleportTarget = null;
			} else {
				this.aimArc(hand);
			}
			return;
		}

		// Flick sideways to turn, once per flick.
		const flick = x > 0.6 ? 1 : x < -0.6 ? -1 : Math.abs(x) < 0.3 ? 0 : hand.flick;
		if (flick !== 0 && flick !== hand.flick) {
			const turned = turnAboutHead(
				this.dolly.position,
				this.dollyYaw,
				this.camera.position,
				-flick * SNAP_TURN
			);
			this.setDolly(turned.position, turned.yaw);
		}
		hand.flick = flick;
	}

	private aimArc(hand: Hand) {
		const origin = hand.ray.getWorldPosition(new Vector3());
		const velocity = new Vector3(0, 0, -1)
			.applyQuaternion(hand.ray.getWorldQuaternion(new Quaternion()))
			.multiplyScalar(8);
		const gravity = new Vector3(0, -9.8, 0);
		const floorY = this.floorY();
		const positions = this.arc.geometry.getAttribute('position') as Float32BufferAttribute;
		const step = 0.03;
		let previous = origin.clone();
		let count = 1;
		let target: { point: Vector3; onModel: boolean } | null = null;
		let invalidAt: Vector3 | null = null;
		const segmentBox = new Box3();
		positions.setXYZ(0, origin.x, origin.y, origin.z);

		for (let i = 1; i < positions.count; i++) {
			const t = i * step;
			const next = origin
				.clone()
				.addScaledVector(velocity, t)
				.addScaledVector(gravity, 0.5 * t * t);
			const segment = next.clone().sub(previous);
			const length = segment.length();
			let hit: Intersection | undefined;
			// Most of an arc is in the air beside the model; only segments
			// that reach its box are worth testing against every mesh.
			if (segmentBox.setFromPoints([previous, next]).intersectsBox(this.worldBounds)) {
				this.raycaster.set(previous, segment.normalize());
				this.raycaster.far = length;
				[hit] = this.raycaster.intersectObjects(this.targets, false);
				this.raycaster.far = Infinity;
			}

			let end: Vector3 | null = null;
			if (hit) {
				end = hit.point;
				const { normal } = modelHit(hit, segment);
				if (normal.y > 0.6) target = { point: hit.point.clone(), onModel: true };
				else invalidAt = hit.point.clone();
			} else if (previous.y >= floorY && next.y < floorY) {
				const f = (previous.y - floorY) / (previous.y - next.y);
				end = previous.clone().lerp(next, f);
				target = { point: end.clone(), onModel: false };
			}

			const p = end ?? next;
			positions.setXYZ(i, p.x, p.y, p.z);
			count = i + 1;
			if (end) break;
			previous = next;
		}

		positions.needsUpdate = true;
		this.arc.geometry.setDrawRange(0, count);
		this.arc.visible = true;
		const colour = target ? hex.accent : hex.danger;
		(this.arc.material as LineBasicMaterial).color.setHex(colour);
		(this.marker.material as MeshBasicMaterial).color.setHex(colour);
		const at = target?.point ?? invalidAt;
		this.marker.visible = !!at;
		if (at) this.marker.position.copy(at).y += 0.01;
		this.teleportTarget = target;
	}

	/** Where the arc lands when it misses the model: the room's floor, or the model's ground. */
	private floorY(): number {
		if (this.world.scale.x < 1 || this.bounds.isEmpty()) return this.dolly.position.y;
		return this.bounds.min.clone().applyMatrix4(this.world.matrixWorld).y;
	}

	private teleport({ point, onModel }: { point: Vector3; onModel: boolean }) {
		// Teleporting onto the miniature means stepping into it, life-size.
		if (onModel && this.world.scale.x < 1) {
			const inModel = this.toModel(point);
			this.resetWorld();
			this.setDolly(
				placeFeet(this.camera.position, this.dollyYaw, new Vector3(...inModel)),
				this.dollyYaw
			);
			this.say('1:1');
			return;
		}
		this.setDolly(placeFeet(this.camera.position, this.dollyYaw, point), this.dollyYaw);
	}

	/** One grip drags the world; both grips scale and turn it. */
	private updateGrab() {
		const held = this.hands.filter((h) => h.source?.gamepad?.buttons[SQUEEZE]?.pressed);
		const at = (h: Hand) => h.ray.getWorldPosition(new Vector3());

		if (held.length === 2) {
			const [a, b] = held.map(at);
			const mid = a.clone().add(b).multiplyScalar(0.5);
			const distance = Math.max(0.01, a.distanceTo(b));
			const angle = Math.atan2(b.x - a.x, b.z - a.z);
			if (this.grab.mode !== 'two') {
				for (const h of held) this.buzz(h, 0.2, 20);
				this.world.updateMatrix();
				this.grab = {
					mode: 'two',
					start: this.world.matrix.clone(),
					scale: this.world.scale.x,
					mid,
					distance,
					angle
				};
				return;
			}
			const g = this.grab;
			const ratio = snapScale((g.scale * distance) / g.distance) / g.scale;
			const m = new Matrix4()
				.makeTranslation(mid.x, mid.y, mid.z)
				.multiply(new Matrix4().makeRotationY(angle - g.angle))
				.multiply(new Matrix4().makeScale(ratio, ratio, ratio))
				.multiply(new Matrix4().makeTranslation(-g.mid.x, -g.mid.y, -g.mid.z))
				.multiply(g.start);
			m.decompose(this.world.position, this.world.quaternion, this.world.scale);
			this.say(scaleLabel(this.world.scale.x));
			return;
		}

		if (held.length === 1) {
			const hand = held[0];
			if (this.grab.mode !== 'one' || this.grab.hand !== hand) {
				// Not when one hand of a two-hand grab lets go: nothing new began.
				if (this.grab.mode === 'none') this.buzz(hand, 0.2, 20);
				this.grab = { mode: 'one', hand, anchor: at(hand) };
				return;
			}
			// Moving the dolly moves the hand with it, so after this the hand is
			// back on the anchor: the world feels held.
			this.dolly.position.add(this.grab.anchor.clone().sub(at(hand)));
			return;
		}

		this.grab = { mode: 'none' };
	}

	// ── Placing the person and the model ───────────────────────────────────

	private setDolly(position: Vector3, yaw: number) {
		this.dolly.position.copy(position);
		this.dollyYaw = yaw;
		this.dolly.rotation.set(0, yaw, 0);
		this.dolly.updateMatrixWorld(true);
	}

	private headYaw(): number {
		return this.dollyYaw + yawOf(this.camera.quaternion);
	}

	private placeHeadAt(eye: Vector3, yaw: number) {
		const placed = placeHead(this.camera.position, yawOf(this.camera.quaternion), eye, yaw);
		this.setDolly(placed.position, placed.yaw);
	}

	private resetWorld() {
		this.world.position.set(0, 0, 0);
		this.world.quaternion.identity();
		this.world.scale.set(1, 1, 1);
		this.world.updateMatrixWorld(true);
	}

	private toModel(world: Vector3): Vec3 {
		this.world.updateMatrixWorld(true);
		return this.world.worldToLocal(world.clone()).toArray() as Vec3;
	}

	/**
	 * The model as a miniature on a table in front of the person — or on the
	 * floor, if at this scale it's taller than a table would make sense for.
	 */
	private overview(scale?: number) {
		if (this.bounds.isEmpty()) return;
		const size = this.bounds.getSize(new Vector3());
		const s = scale ?? fitScale(Math.max(size.x, size.y, size.z));
		const head = this.camera.getWorldPosition(new Vector3());
		const forward = forwardOf(this.headYaw());
		const radius = 0.5 * Math.hypot(size.x, size.z) * s;
		const base = new Vector3(
			(this.bounds.min.x + this.bounds.max.x) / 2,
			this.bounds.min.y,
			(this.bounds.min.z + this.bounds.max.z) / 2
		);
		const table = size.y * s < 1.1 ? 0.75 : 0;
		const target = head.addScaledVector(forward, 0.4 + radius);
		target.y = this.dolly.position.y + table;

		this.world.quaternion.identity();
		this.world.scale.setScalar(s);
		this.world.position.copy(target).sub(base.multiplyScalar(s));
		this.world.updateMatrixWorld(true);
		this.say(scaleLabel(s));
	}

	/** Life-size, standing where the right hand points — or at the front of the model. */
	private lifeSize() {
		const right = this.hands.find((h) => h.source?.handedness === 'right');
		const hit = right ? this.pick(right) : null;
		if (hit?.kind === 'model') {
			const feet = new Vector3(...this.toModel(this.groundBelow(hit)));
			this.resetWorld();
			this.setDolly(placeFeet(this.camera.position, this.dollyYaw, feet), this.dollyYaw);
		} else {
			this.resetWorld();
			const front = new Vector3(
				(this.bounds.min.x + this.bounds.max.x) / 2,
				this.bounds.min.y + 1.6,
				this.bounds.max.z + 3
			);
			this.placeHeadAt(front, 0);
		}
		this.say('1:1');
	}

	/** A floor to stand on near a pointed-at spot, which may be a wall. */
	private groundBelow(hit: Extract<Hit, { kind: 'model' }>): Vector3 {
		if (hit.normal.y > 0.6) return hit.point;
		const from = hit.point.clone().addScaledVector(this.raycaster.ray.direction, -0.3);
		this.raycaster.set(from, new Vector3(0, -1, 0));
		const [down] = this.raycaster.intersectObjects(this.targets, false);
		if (down) return down.point;
		return from.setY(this.bounds.min.clone().applyMatrix4(this.world.matrixWorld).y);
	}

	private stepView(by: number, hand?: Hand) {
		const n = this.views.length;
		if (!n) {
			this.say('No cameras in this model — save a view from the menu');
			return;
		}
		const next = this.viewIndex < 0 ? (by > 0 ? 0 : n - 1) : (this.viewIndex + by + n) % n;
		this.buzz(hand);
		this.goToView(next);
	}

	private saveView() {
		const head = this.camera.getWorldPosition(new Vector3());
		const worldYaw = yawOf(this.world.quaternion);
		this.hooks.saveView(this.toModel(head), this.headYaw() - worldYaw);
		this.say('View saved');
	}

	// ── Panels ─────────────────────────────────────────────────────────────

	/** In front of the face, a little below eye level, tilted up to it. */
	private placePanel(panel: Panel, distance: number, drop: number) {
		const yaw = yawOf(this.camera.quaternion);
		panel.mesh.position
			.copy(this.camera.position)
			.addScaledVector(forwardOf(yaw), distance)
			.add(new Vector3(0, -drop, 0));
		panel.mesh.rotation.set(-0.3, yaw, 0, 'YXZ');
		panel.mesh.visible = true;
	}

	private toggleMenu() {
		if (this.menu.mesh.visible) this.menu.mesh.visible = false;
		else this.openMenu();
	}

	private openMenu() {
		this.drawMenu();
		this.placePanel(this.menu, 0.6, 0.2);
	}

	/*
	 * The menu, top to bottom: what's open and at what scale, then three
	 * labelled sections of equal-height rows, then the two ways out side by
	 * side. Each row splits the width evenly, so the panel is symmetrical
	 * whatever a row holds.
	 */
	private drawMenu() {
		const s = this.world.scale.x;
		const view = this.views[this.viewIndex];
		const pad = 40;
		const gap = 16;
		const h = 100;
		const row = (y: number, items: Omit<Control, 'x' | 'y' | 'w' | 'h'>[]): Control[] => {
			const w = (1024 - 2 * pad - gap * (items.length - 1)) / items.length;
			return items.map((item, i) => ({ ...item, x: pad + i * (w + gap), y, w, h }));
		};
		const section = (text: string, y: number) => ({
			text,
			x: pad,
			y,
			size: 22,
			weight: 700,
			tone: 'accent' as const
		});
		const noViews = this.views.length === 0;
		const shown = this.markers.group.visible;

		this.menu.set(
			[
				...row(196, [
					{ id: 'prev', label: '◀  Previous', disabled: noViews },
					{ id: 'save-view', label: 'Save view' },
					{ id: 'next', label: 'Next  ▶', disabled: noViews }
				]),
				...row(356, [
					{ id: 'fit', label: 'Fit' },
					{ id: 'scale:1', label: '1:1', active: s === 1 },
					...MENU_SCALES.map((m) => ({ id: `scale:${m}`, label: scaleLabel(m), active: s === m }))
				]),
				...row(516, [
					{
						id: 'add-note',
						label: this.armedNote ? 'Placing…' : 'Add note',
						active: this.armedNote
					},
					{ id: 'notes', label: shown ? 'Hide notes' : 'Show notes' }
				]),
				...row(648, [
					{ id: 'close', label: 'Close menu' },
					{ id: 'exit', label: 'Exit VR', variant: 'danger' }
				])
			],
			[
				{ text: this.modelName || 'No model', x: pad, y: 64, size: 42, weight: 650 },
				{
					text: scaleLabel(s),
					x: 1024 - pad,
					y: 64,
					size: 42,
					weight: 600,
					align: 'right',
					mono: true,
					tone: 'accent'
				},
				{
					text: view
						? `${view.name}  ·  ${this.viewIndex + 1} / ${this.views.length}`
						: `${this.views.length} views`,
					x: pad,
					y: 114,
					size: 30,
					tone: 'dim'
				},
				section('VIEWS', 174),
				section('SCALE', 334),
				section('NOTES', 494),
				{
					text: 'A B views   ·   X note   ·   Y menu   ·   grips grab and scale',
					x: 512,
					y: 772,
					size: 24,
					align: 'center',
					tone: 'dim'
				}
			]
		);
	}

	private press(panel: Panel, id: string) {
		if (panel === this.keyboard) {
			this.typeKey(id);
			return;
		}
		if (id === 'prev') this.stepView(-1);
		else if (id === 'next') this.stepView(1);
		else if (id === 'save-view') this.saveView();
		else if (id === 'fit') this.overview();
		else if (id === 'scale:1') this.lifeSize();
		else if (id.startsWith('scale:')) this.overview(Number(id.slice(6)));
		else if (id === 'add-note') {
			this.armedNote = !this.armedNote;
			if (this.armedNote) this.say('Point at the model and pull the trigger');
		} else if (id === 'notes') this.markers.group.visible = !this.markers.group.visible;
		else if (id === 'close') this.menu.mesh.visible = false;
		else if (id === 'exit') this.exitVR();
		if (this.menu.mesh.visible) this.drawMenu();
	}

	private openEditor(id: string, isNew: boolean) {
		const note = this.findNote(id);
		const text = note?.text ?? '';
		this.editing = { id, text, shift: autoShift(text), isNew, done: note?.done ?? false };
		this.drawKeyboard();
		// Both panels draw over everything, so two at once is unreadable.
		this.menu.mesh.visible = false;
		this.placePanel(this.keyboard, 0.5, 0.35);
	}

	private findNote(id: string): Annotation | undefined {
		return this.notesById?.(id);
	}

	/** Set by the page so the keyboard can start from a note's current text. */
	notesById: ((id: string) => Annotation | undefined) | null = null;

	private typeKey(id: string) {
		const e = this.editing;
		if (!e) return;
		if (id === 'resolve') {
			this.hooks.setNoteText(e.id, e.text.trim());
			this.hooks.toggleNote(e.id);
			this.closeEditor();
			return;
		}
		if (id === 'delete') {
			this.hooks.deleteNote(e.id);
			this.closeEditor();
			return;
		}
		const r = pressKey(e.text, e.shift, id);
		if (r.done === 'save') {
			this.hooks.setNoteText(e.id, r.text.trim());
			this.closeEditor();
			return;
		}
		if (r.done === 'cancel') {
			if (e.isNew) this.hooks.discardIfEmpty(e.id);
			this.closeEditor();
			return;
		}
		e.text = r.text;
		e.shift = r.shift;
		this.drawKeyboard();
	}

	private closeEditor() {
		this.editing = null;
		this.keyboard.mesh.visible = false;
	}

	private drawKeyboard() {
		const e = this.editing;
		if (!e) return;
		const pad = 24;
		const gap = 10;
		const unit = (1024 - 2 * pad - 9 * gap) / 10;
		const controls: Control[] = [];
		if (!e.isNew) {
			controls.push(
				{ id: 'resolve', label: e.done ? 'Reopen' : 'Resolve', x: 600, y: 22, w: 190, h: 60 },
				{ id: 'delete', label: 'Delete', x: 810, y: 22, w: 190, h: 60, variant: 'danger' }
			);
		}
		controls.push({
			id: 'field',
			label: '',
			x: pad,
			y: 100,
			w: 1024 - 2 * pad,
			h: 92,
			variant: 'field'
		});
		keyboardRows(e.shift).forEach((keys, r) => {
			const width = keys.reduce((w, k) => w + k.span * unit + (k.span - 1) * gap, 0);
			let x = (1024 - width - gap * (keys.length - 1)) / 2;
			for (const key of keys) {
				const w = key.span * unit + (key.span - 1) * gap;
				controls.push({
					id: key.id,
					label: key.label,
					x,
					y: 214 + r * 92,
					w,
					h: 82,
					active: key.id === 'shift' && e.shift,
					variant: key.id === 'save' ? 'primary' : undefined
				});
				x += w + gap;
			}
		});
		this.keyboard.set(controls, [
			{
				text: e.isNew ? 'NEW NOTE' : 'NOTE',
				x: pad + 8,
				y: 54,
				size: 24,
				weight: 700,
				tone: 'note'
			},
			{ text: (e.text || '') + '▏', x: pad + 28, y: 148, size: 42 }
		]);
	}

	private say(text: string) {
		this.toastUntil = this.lastTime + 2200;
		// Two-hand scaling says the scale every frame. Redrawing a canvas is a
		// texture upload, so it happens only when the words change.
		if (text === this.toastText && this.toast.mesh.visible) return;
		this.toastText = text;
		this.toast.set([], [{ text, x: 512, y: 62, size: 50, weight: 600, align: 'center' }]);
		this.toast.mesh.visible = true;
		if (this.menu.mesh.visible) this.drawMenu();
	}

	/**
	 * A short pulse in the hand that did something — the confirmation a
	 * button gives by clicking, which a ray pointed at a picture can't.
	 */
	private buzz(hand: Hand | undefined, intensity = 0.3, ms = 25) {
		const actuator = (
			hand?.source?.gamepad as
				{ hapticActuators?: { pulse?: (v: number, ms: number) => Promise<boolean> }[] } | undefined
		)?.hapticActuators?.[0];
		actuator?.pulse?.(intensity, ms)?.catch(() => {
			// A controller without a motor, or one asleep: nothing to tell.
		});
	}
}

function modelHit(hit: Intersection, along: Vector3): Extract<Hit, { kind: 'model' }> {
	const normal = hit.face
		? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
		: new Vector3(0, 1, 0);
	// Exporters don't agree on winding, and SketchUp models are often only
	// one face thick: a floor seen "from behind" is still a floor. The side
	// that counts is the one facing the ray.
	if (normal.dot(along) > 0) normal.negate();
	return { kind: 'model', point: hit.point.clone(), normal, distance: hit.distance };
}

function deadzone(v: number): number {
	return Math.abs(v) < DEADZONE ? 0 : v;
}

function dispose(root: Object3D) {
	root.traverse((o) => {
		const mesh = o as Mesh;
		if (!mesh.isMesh) return;
		mesh.geometry?.dispose();
		const materials = (
			Array.isArray(mesh.material) ? mesh.material : [mesh.material]
		) as Material[];
		for (const m of materials) {
			for (const value of Object.values(m)) {
				if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
			}
			m.dispose();
		}
	});
}

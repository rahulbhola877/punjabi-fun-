import type { AbstractMesh, Observer, Scene } from "../babylon";

/**
 * Babylon checks readiness and touches LOD state before testing isEnabled in
 * its default scene-wide scan. A streamed world can have thousands of disabled
 * chunks, so keep the render candidates in step with effective enabled state.
 * This only removes disabled meshes: visibility, frustum, LOD, shadows and
 * readiness remain Babylon's decisions, including for newly spawned objects.
 */
export class EnabledMeshCandidates {
  private enabled = new Set<AbstractMesh>();
  private observers = new Map<AbstractMesh, Observer<boolean> | null>();
  private candidates: { data: AbstractMesh[]; length: number } = { data: [], length: 0 };
  private dirty = true;
  private previous: Scene["getActiveMeshCandidates"];
  private added: Observer<AbstractMesh> | null;
  private removed: Observer<AbstractMesh> | null;
  private select = () => {
    // Babylon defers its new-mesh notification to the next task. Objects
    // spawned during a simulation step must still appear in this very frame.
    if (this.scene.meshes.length !== this.observers.size) {
      for (const mesh of this.scene.meshes) this.track(mesh);
    }
    if (this.dirty) {
      this.candidates.data.length = 0;
      for (const mesh of this.enabled) this.candidates.data.push(mesh);
      this.candidates.length = this.candidates.data.length;
      this.dirty = false;
    }
    return this.candidates;
  };

  constructor(private scene: Scene) {
    this.previous = scene.getActiveMeshCandidates;
    for (const mesh of scene.meshes) this.track(mesh);
    this.added = scene.onNewMeshAddedObservable.add(mesh => {
      // A deferred notification may arrive after the mesh was removed again.
      if (!this.observers.has(mesh) && scene.meshes.includes(mesh)) this.track(mesh);
    });
    this.removed = scene.onMeshRemovedObservable.add(mesh => this.untrack(mesh));
    scene.getActiveMeshCandidates = this.select;
  }

  private track(mesh: AbstractMesh): void {
    if (this.observers.has(mesh) || mesh.isDisposed()) return;
    if (mesh.isEnabled()) { this.enabled.add(mesh); this.dirty = true; }
    // Own-state events miss changes inherited from a parent and reparenting.
    const observer = mesh.onEffectiveEnabledStateChangedObservable.add(enabled => {
      if (enabled) this.enabled.add(mesh);
      else this.enabled.delete(mesh);
      this.dirty = true;
    });
    this.observers.set(mesh, observer);
  }

  private untrack(mesh: AbstractMesh): void {
    const observer = this.observers.get(mesh);
    if (observer) mesh.onEffectiveEnabledStateChangedObservable.remove(observer);
    this.observers.delete(mesh);
    if (this.enabled.delete(mesh)) this.dirty = true;
  }

  dispose(): void {
    if (this.scene.getActiveMeshCandidates === this.select) this.scene.getActiveMeshCandidates = this.previous;
    this.scene.onNewMeshAddedObservable.remove(this.added);
    this.scene.onMeshRemovedObservable.remove(this.removed);
    for (const mesh of this.observers.keys()) this.untrack(mesh);
    this.candidates.data.length = 0;
    this.candidates.length = 0;
  }
}

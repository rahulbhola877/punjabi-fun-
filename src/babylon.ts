/**
 * Babylon.js facade: every engine symbol the game uses, imported from its
 * deep module path. Importing the "@babylonjs/core" barrel made production
 * builds take 25+ minutes; deep imports keep the bundle and build time small.
 * The non-".pure" modules are used deliberately: they register the runtime
 * side effects (scene components, shader loaders) the game relies on.
 */
export { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
export { Bone } from "@babylonjs/core/Bones/bone";
export { Skeleton } from "@babylonjs/core/Bones/skeleton";
export { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
export { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
export { Space } from "@babylonjs/core/Maths/math.axis";
export { Engine } from "@babylonjs/core/Engines/engine";
export { NullEngine } from "@babylonjs/core/Engines/nullEngine";
export { Scene } from "@babylonjs/core/scene";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode";
export { Mesh } from "@babylonjs/core/Meshes/mesh";
export { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
export { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
export { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
export { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
export { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
export { Material } from "@babylonjs/core/Materials/material";
export { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
export { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
export { Texture } from "@babylonjs/core/Materials/Textures/texture";
export { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
export { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
export { ColorCurves } from "@babylonjs/core/Materials/colorCurves";
export { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
export { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
export { PointLight } from "@babylonjs/core/Lights/pointLight";
export { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
export { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
export { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
export { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
export { BoxParticleEmitter } from "@babylonjs/core/Particles/EmitterTypes/boxParticleEmitter";
export { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
export { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
export { Observer } from "@babylonjs/core/Misc/observable";
export { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
export { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
export { PhysicsShapeBox, PhysicsShapeCapsule, PhysicsShapeContainer } from "@babylonjs/core/Physics/v2/physicsShape";
export { PhysicsMotionType, PhysicsPrestepType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
export type { IPhysicsCollisionEvent } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
export { PhysicsCharacterController, CharacterSupportedState } from "@babylonjs/core/Physics/v2/characterController";
export type { CharacterSurfaceInfo } from "@babylonjs/core/Physics/v2/characterController";
export { PhysicsRaycastResult } from "@babylonjs/core/Physics/physicsRaycastResult";
export type { PhysicsEngine as PhysicsEngineV2 } from "@babylonjs/core/Physics/v2/physicsEngine";

// Side-effect registrations (scene components) needed at runtime.
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import "@babylonjs/core/Meshes/Builders/torusBuilder";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@babylonjs/core/Engines/AbstractEngine/abstractEngine.timeQuery";
import "@babylonjs/core/Engines/Extensions/engine.query";

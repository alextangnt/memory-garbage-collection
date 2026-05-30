



// Code taken from Golan Levin's template: https://openprocessing.org/sketch/2059071

// Original copyright:
// Copyright (c) 2023 ml5
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
// Originally from https://editor.p5js.org/ml5/sketches/QGH3dwJ1A
// Requires: https://unpkg.com/ml5@0.20.0-alpha.3/dist/ml5.js
let zigProgress = 0
let w = 1620
let h = 1080
let mw = 640
let mh = 480
let wratio = w/mw
let hratio = h/mh
let handTracker;
let grabbables = [];
let zig = [];
let zstart;
let zigmode = false;

let handpose;
let video;
let hands = [];
let hand = [];
let bodyGrabbablesData = null;
let uiInteractionsData = null;
let toolConfigData = null;
let interactionModel = null;
let globalPinchGeneration = 0;
let options = { maxHands: 2, flipHorizontal: true };
let grabRenderCounter = 0;
let s = 15
const TRACKING_OVERFLOW_SCALE_X = 1.5;
const TRACKING_OVERFLOW_SCALE_Y = 1.45;
const HAND_MAX = 2;
const PINCH_CLOSE_RATIO = 0.3;
const PINCH_OPEN_RATIO = 0.62;
const PINCH_HOLD_FRAMES = 2;
const HAND_SMOOTH_ALPHA = 0.58;
const MAX_TRACK_JUMP = 130;
const MAX_MISSED_FRAMES = 10;
const HOME_RIGHT_OFFSET_X = 170;
const HOME_LEFT_OFFSET_X = -170;
const HOME_OFFSET_Y = 40;
const OFFSCREEN_MARGIN_X = 220;
const OFFSCREEN_MARGIN_Y = 220;
const OFFSCREEN_RETREAT_FRAMES = 60;
const OFFSCREEN_ARC_BOW = 70;
const HAND_STALE_MS = 120;
const RECONNECT_GRAB_COOLDOWN_FRAMES = 8;
const PINCH_TRIGGER_RANGE_SCALE = 0.7;
const THROW_DECEL = 0.72;
const THROW_SMALL_THRESHOLD = 12.2;
const THROW_BIG_THRESHOLD = 30.2;
const THROW_SMALL_SPEED = 50.0;
const THROW_BIG_SPEED = 140.0;
const THROW_SPIN_DAMP = 0.75;
const THROW_VELOCITY_HISTORY_SIZE = 5;
const THROW_TIER_OLDEST_SAMPLE_COUNT = 4;
const PICKUP_TO_OBJECT_LERP = 0.45;
const PICKUP_RETURN_LERP = 0.28;
const PICKUP_ATTACH_DIST = 10;
const PICKUP_RETURN_DIST = 12;
const CLAW_PICKUP_SHRINK_SCALE = 0.82;
const CLAW_SCALE_LERP = 0.3;
const DEFAULT_TOOL_CONFIG = {
	rightToolAngle: -45,
	leftToolAngle: 45,
	interactionRadiusFactor: 1.0,
	tipAxisOffsetDeg: -90,
	cutCooldownFrames: 10,
	cutScalpelMinSpeed: 4,
	cutScalpelMaxSpeed: 10,
	cutBonesawMinSpeed: 10,
	cutHammerMinSpeed: 15,
	toolPreviewAngleDeltaDeg: 5,
	toolPreviewClawScale: 0.9,
	toolPreviewToolScale: 0.9,
	toolPreviewStartChunks: 1,
	toolPreviewEndChunks: 2,
	toolVelocityChunkFrames: 4,
	toolSustainChunksRequired: 3,
	tools: { items: [] }
};
const DEFAULT_UI_CONFIG = {
	uiHitboxes: [],
	panel: { x1: 450, y1: 850, x2: 1500, y2: 1000, lockY: 925, dragDamp: 0.86, dragMaxSpeed: 18, moveSpeedThreshold: 1.2 },
	drawer: {
		lockX: 1450, detachX: 1100, pullTriggerDx: 55, detachLerp: 0.62, detachDoneDist: 10, detachMaxFrames: 10,
		toolDropLeftX: 1100, uiYOffset: 50,
		hitboxes: [
			{ x1: 1400, y1: 150, x2: 1620, y2: 400, lockY: 275 },
			{ x1: 1400, y1: 450, x2: 1620, y2: 700, lockY: 575 },
			{ x1: 1400, y1: 750, x2: 1620, y2: 1000, lockY: 875 }
		]
	},
	bins: {
		lockX: 300, lockZoneX1: 250, lockZoneX2: 400, openSpeedThreshold: 12, consumeFrames: 30,
		top: { x1: 0, y1: 200, x2: 400, y2: 500, centerX: 200, centerY: 350 },
		bottom: { x1: 0, y1: 600, x2: 400, y2: 900, centerX: 200, centerY: 750 }
	}
};
let toolConfig = JSON.parse(JSON.stringify(DEFAULT_TOOL_CONFIG));
let uiConfig = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
const CLAW_FEEDBACK_JITTER_FRAMES = 8;
const CLAW_FEEDBACK_JITTER_MAG = 15;
const CLAW_FEEDBACK_LAUNCH_FRAMES = 11;
const CLAW_FEEDBACK_LAUNCH_SCALE = 1.32;
const PANEL_FAIL_JITTER_SPEED = 2.4;
const PANEL_RETURN_FRAMES = 14;
const PANEL_RETURN_BACK_RATIO = 0.28;
const PANEL_RETURN_BACK_PIXELS = 40;

let dragPanel = {
	offsetY: 0,
	prevOffsetY: 0,
	engaged: false,
	leftMagnet: false,
	rightMagnet: false,
	leftPrevPinch: false,
	rightPrevPinch: false,
	leftAnchorX: 0,
	rightAnchorX: 0,
	baseSpacing: 0,
	lastLeftY: 0,
	lastRightY: 0,
	velY: 0,
	initialOffsetY: 0,
	returnAnimating: false,
	returnFrame: 0,
	returnStartOffsetY: 0,
	wasAtVerticalBound: false
};
let drawerGrabState = {
	left: null,
	right: null
};
let binGrabState = {
	left: null,
	right: null
};
let binConsumeState = {
	top: null,
	bottom: null
};
let panelJitterOffsetX = 0;
let panelJitterOffsetY = 0;
let lidTopJitterOffsetX = 0;
let lidTopJitterOffsetY = 0;
let lidBottomJitterOffsetX = 0;
let lidBottomJitterOffsetY = 0;
let panelJitterState = { framesLeft: 0, mag: 0 };
let lidJitterStateTop = { framesLeft: 0, mag: 0 };
let lidJitterStateBottom = { framesLeft: 0, mag: 0 };

function triggerPanelJitter(mag = 4, frames = 8) {
	panelJitterState.framesLeft = max(panelJitterState.framesLeft, frames);
	panelJitterState.mag = max(panelJitterState.mag, mag);
}

function triggerBinLidJitter(binIdx, mag = 4, frames = 8) {
	// Bin indices map opposite to lid art ordering in current UI.
	const tgt = binIdx === 0 ? lidJitterStateBottom : lidJitterStateTop;
	tgt.framesLeft = max(tgt.framesLeft, frames);
	tgt.mag = max(tgt.mag, mag);
}

function stepJitterState(stateObj) {
	if (!stateObj || stateObj.framesLeft <= 0) return { x: 0, y: 0 };
	const t = stateObj.framesLeft / max(1, stateObj.framesLeft + 1);
	const m = stateObj.mag * t;
	stateObj.framesLeft--;
	if (stateObj.framesLeft <= 0) {
		stateObj.mag = 0;
		return { x: 0, y: 0 };
	}
	return { x: random(-m, m), y: random(-m, m) };
}

function updateUiJitterOffsets() {
	const p = stepJitterState(panelJitterState);
	panelJitterOffsetX = p.x;
	panelJitterOffsetY = p.y;
	const a = stepJitterState(lidJitterStateTop);
	lidTopJitterOffsetX = a.x;
	lidTopJitterOffsetY = a.y;
	const b = stepJitterState(lidJitterStateBottom);
	lidBottomJitterOffsetX = b.x;
	lidBottomJitterOffsetY = b.y;
}

function vdist(p1,p2){
	return dist(p1.x,p1.y,p2.x,p2.y)
}
function vadd(p1,p2){
	return createVector(p1.x+p2.x,p1.y+p2.y)
}
function mid(p1,p2){
	return createVector((p1.x+p2.x)/2,(p1.y+p2.y)/2)
}
function mapTrackedPoint(rawX, rawY){
	const baseX = rawX * wratio;
	const baseY = rawY * hratio;
	const cx = w / 2;
	const cy = h / 2;
	return createVector(
		(baseX - cx) * TRACKING_OVERFLOW_SCALE_X + cx,
		(baseY - cy) * TRACKING_OVERFLOW_SCALE_Y + cy
	);
}
function getWindowScaleFactor() {
	return max(0.1, min(windowWidth / w, windowHeight / h));
}
function scaleDistanceForWindow(baseDistance) {
	return baseDistance / getWindowScaleFactor();
}
function scaleSpeedForWindow(baseSpeed) {
	return baseSpeed / getWindowScaleFactor();
}
function getHomePinch(side){
	const cx = w / 2;
	const cy = h / 2;
	if (side === "left") {
		return createVector(cx + HOME_LEFT_OFFSET_X, cy + HOME_OFFSET_Y);
	}
	return createVector(cx + HOME_RIGHT_OFFSET_X, cy + HOME_OFFSET_Y);
}
function getOffscreenPinch(side){
	if (side === "left") {
		return createVector(-OFFSCREEN_MARGIN_X, h + OFFSCREEN_MARGIN_Y);
	}
	return createVector(w + OFFSCREEN_MARGIN_X, h + OFFSCREEN_MARGIN_Y);
}
function inferHandSide(hand){
	if (hand && typeof hand.handedness === "string") {
		const side = hand.handedness.toLowerCase();
		if (side === "left" || side === "right") return side;
	}
	if (hand && hand.handedness && hand.handedness.label) {
		const side = String(hand.handedness.label).toLowerCase();
		if (side === "left" || side === "right") return side;
	}
	if (hand && Array.isArray(hand.handednesses) && hand.handednesses.length > 0) {
		const label = String(hand.handednesses[0]?.label || hand.handednesses[0]?.categoryName || "").toLowerCase();
		if (label === "left" || label === "right") return label;
	}
	// Fallback heuristic for mirrored webcam feeds.
	const thumb = hand.keypoints?.[ML5HAND_THUMB_TIP];
	const index = hand.keypoints?.[ML5HAND_INDEX_FINGER_TIP];
	if (thumb && index) {
		return thumb.x > index.x ? "left" : "right";
	}
	return "right";
}

function createInteractionModel() {
	return {
		itemsById: new Map(),
		hitboxesById: new Map(),
		bodyItemIds: new Map(),
		bodyHitboxIds: new Map(),
		rulesByItemId: new Map(),
		grabbableIndexByHitboxId: new Map()
	};
}

function resetInteractionModel() {
	interactionModel = createInteractionModel();
}

function getOrCreateModelItem(bodyKey, itemId, def) {
	if (!interactionModel.itemsById.has(itemId)) {
		interactionModel.itemsById.set(itemId, {
			id: itemId,
			bodyKey: bodyKey,
			state: def.initialState || "default",
			picKey: def.picKey || null,
			flags: { hasBeenInteracted: false },
			hitboxIds: [],
			ruleIds: []
		});
	}
	if (!interactionModel.bodyItemIds.has(bodyKey)) {
		interactionModel.bodyItemIds.set(bodyKey, []);
	}
	const bodyItemIds = interactionModel.bodyItemIds.get(bodyKey);
	if (!bodyItemIds.includes(itemId)) {
		bodyItemIds.push(itemId);
	}
	return interactionModel.itemsById.get(itemId);
}

function registerModelHitbox(bodyKey, itemDef, hitboxDef, id, g, grabbableIndex) {
	if (!interactionModel) {
		resetInteractionModel();
	}
	const itemId = itemDef.itemId || hitboxDef.itemId || hitboxDef.idName;
	const hitboxId = hitboxDef.hitboxId || hitboxDef.idName;
	const item = getOrCreateModelItem(bodyKey, itemId, itemDef);
	const hitbox = {
		id: hitboxId,
		itemId: itemId,
		bodyKey: bodyKey,
		itemCode: id,
		mode: hitboxDef.mode || "grab",
		grabbableIndex: grabbableIndex,
		radius: hitboxDef.radius,
		center: { x: hitboxDef.x, y: hitboxDef.y },
		enabled: true,
		picKey: hitboxDef.picKey || itemDef.picKey || null,
		isPlaceholder: (hitboxDef.picKey || itemDef.picKey || null) == null,
		consumeOnInteract: !!hitboxDef.consumeOnInteract,
		revealHidden: !!hitboxDef.revealHidden,
		interactionMode: hitboxDef.interactionMode || null,
		requiredTool: hitboxDef.requiredTool || null,
		cutCooldownFrames: hitboxDef.cutCooldownFrames || toolConfig.cutCooldownFrames,
		requireFlagsTrue: Array.isArray(hitboxDef.requireFlagsTrue) ? hitboxDef.requireFlagsTrue : [],
		onRequirementFail: hitboxDef.onRequirementFail || null,
		clearScalpelInUse: !!hitboxDef.clearScalpelInUse,
		revealHitboxIds: Array.isArray(hitboxDef.revealHitboxIds) ? hitboxDef.revealHitboxIds : [],
		hideHitboxIds: Array.isArray(hitboxDef.hideHitboxIds) ? hitboxDef.hideHitboxIds : [],
		rules: Array.isArray(hitboxDef.rules) ? hitboxDef.rules : []
	};
	interactionModel.hitboxesById.set(hitboxId, hitbox);
	interactionModel.grabbableIndexByHitboxId.set(hitboxId, grabbableIndex);
	item.hitboxIds.push(hitboxId);

	if (!interactionModel.bodyHitboxIds.has(bodyKey)) {
		interactionModel.bodyHitboxIds.set(bodyKey, []);
	}
	interactionModel.bodyHitboxIds.get(bodyKey).push(hitboxId);

	const ruleDefs = Array.isArray(hitboxDef.rules) ? hitboxDef.rules : [];
	for (let i = 0; i < ruleDefs.length; i++) {
		const ruleId = ruleDefs[i].id || `${itemId}_rule_${i}`;
		if (!interactionModel.rulesByItemId.has(itemId)) {
			interactionModel.rulesByItemId.set(itemId, []);
		}
		interactionModel.rulesByItemId.get(itemId).push({
			id: ruleId,
			itemId: itemId,
			definition: ruleDefs[i]
		});
		item.ruleIds.push(ruleId);
	}

	// Back-reference for compatibility while we migrate logic in later steps.
	g.modelItemId = itemId;
	g.modelHitboxId = hitboxId;
	g.isConsumed = false;
}

function getModelHitboxesForItem(itemId) {
	if (!interactionModel || !interactionModel.itemsById.has(itemId)) {
		return [];
	}
	const item = interactionModel.itemsById.get(itemId);
	const out = [];
	for (let i = 0; i < item.hitboxIds.length; i++) {
		const hb = interactionModel.hitboxesById.get(item.hitboxIds[i]);
		if (hb) {
			out.push(hb);
		}
	}
	return out;
}

function markModelItemInteracted(itemId) {
	if (!interactionModel || !interactionModel.itemsById.has(itemId)) {
		return;
	}
	interactionModel.itemsById.get(itemId).flags.hasBeenInteracted = true;
}

function applyHitboxDeclarativeRules(g) {
	if (!g || !interactionModel || !g.modelHitboxId) {
		return false;
	}
	const hb = interactionModel.hitboxesById.get(g.modelHitboxId);
	if (!hb) {
		return false;
	}
	for (let i = 0; i < hb.requireFlagsTrue.length; i++) {
		const f = hb.requireFlagsTrue[i];
		if (!globalThis[f]) {
			if (hb.onRequirementFail === "resetOrigin") {
				untoss(g);
			}
			return false;
		}
	}
	if (hb.clearScalpelInUse) {
		scalpelInUse = false;
	}
	for (let i = 0; i < hb.revealHitboxIds.length; i++) {
		const revealId = hb.revealHitboxIds[i];
		const revealHb = interactionModel.hitboxesById.get(revealId);
		if (!revealHb) {
			continue;
		}
		const revealG = grabbables[revealHb.grabbableIndex];
		if (revealG) {
			revealG.isConsumed = false;
			revealG.active = true;
			revealG.minPinchGeneration = globalPinchGeneration + 1;
			revealG.hasBeenGrabbed = false;
			untoss(revealG);
			revealG.visible = !revealHb.revealHidden;
		}
	}
	for (let i = 0; i < hb.hideHitboxIds.length; i++) {
		const hideId = hb.hideHitboxIds[i];
		const hideHb = interactionModel.hitboxesById.get(hideId);
		if (!hideHb) {
			continue;
		}
		const hideG = grabbables[hideHb.grabbableIndex];
		if (hideG) {
			hideG.visible = false;
			hideG.active = false;
			// Hidden is not consumed: tools may be reset/reopened later.
			hideG.isConsumed = false;
			toss(hideG);
		}
	}
	if (hb.consumeOnInteract) {
		g.isConsumed = true;
		g.active = false;
		toss(g);
	}
	return hb.consumeOnInteract ||
		hb.clearScalpelInUse ||
		hb.revealHitboxIds.length > 0 ||
		hb.hideHitboxIds.length > 0;
}

function handleBody1ItemFirstGrab(g) {
	if (!g || !g.modelItemId) {
		return false;
	}
	if (g.modelItemId === "b1_flap") {
		markModelItemInteracted("b1_flap");
		return true;
	}
	if (g.modelItemId === "b1_arm") {
		markModelItemInteracted("b1_arm");
		return true;
	}
	if (g.modelItemId === "b1_leg") {
		const itemHitboxes = getModelHitboxesForItem("b1_leg");
		for (let i = 0; i < itemHitboxes.length; i++) {
			const hb = itemHitboxes[i];
			if (hb.id === g.modelHitboxId) {
				continue;
			}
			const sibling = grabbables[hb.grabbableIndex];
			if (sibling) {
				toss(sibling);
			}
		}
		markModelItemInteracted("b1_leg");
		return true;
	}
	if (g.modelItemId === "b1_eye" && g.modelHitboxId === "b1_eye_lid") {
		applyHitboxDeclarativeRules(g);
		markModelItemInteracted("b1_eye");
		return true;
	}
	if (g.modelItemId === "b1_eye" && g.modelHitboxId === "b1_eye_ball") {
		markModelItemInteracted("b1_eye");
		return true;
	}
	return false;
}

function handleBody2ItemFirstGrab(g) {
	if (!g || !g.modelItemId || !g.modelItemId.startsWith("b2_")) {
		return false;
	}
	const applied = applyHitboxDeclarativeRules(g);
	if (!applied) {
		const hb = interactionModel?.hitboxesById?.get(g.modelHitboxId);
		if (hb && hb.requireFlagsTrue && hb.requireFlagsTrue.length > 0) {
			// Requirement-gated hitboxes (e.g. skin needs scalpel) must remain retryable.
			g.hasBeenGrabbed = false;
			g.isGrabbed = false;
			return true;
		}
	}
	markModelItemInteracted(g.modelItemId);
	return true;
}

function handleBody3ItemFirstGrab(g) {
	if (!g || !g.modelItemId || !g.modelItemId.startsWith("b3_")) {
		return false;
	}
	const applied = applyHitboxDeclarativeRules(g);
	if (!applied) {
		const hb = interactionModel?.hitboxesById?.get(g.modelHitboxId);
		if (hb && hb.requireFlagsTrue && hb.requireFlagsTrue.length > 0) {
			// Requirement-gated hitboxes must remain retryable.
			g.hasBeenGrabbed = false;
			g.isGrabbed = false;
			return true;
		}
	}
	markModelItemInteracted(g.modelItemId);
	return true;
}

function isToolItem(itemID) {
	return itemID === "tool_scalpel" || itemID === "tool_bonesaw" || itemID === "tool_hammer";
}

function getToolGrabbable(toolItemId) {
	for (let i = 0; i < grabbables.length; i++) {
		const g = grabbables[i];
		if (g && g.modelItemId === toolItemId) return g;
	}
	return null;
}

function getHandBySide(side) {
	if (!handTracker || !Array.isArray(handTracker.hands)) return null;
	for (let i = 0; i < handTracker.hands.length; i++) {
		const h = handTracker.hands[i];
		if (h && h.handSide === side) return h;
	}
	return null;
}

function isPointInPanelHitbox(p) {
	if (!p) return false;
	const y1 = uiConfig.panel.y1 + dragPanel.offsetY;
	const y2 = uiConfig.panel.y2 + dragPanel.offsetY;
	return p.x >= uiConfig.panel.x1 && p.x <= uiConfig.panel.x2 && p.y >= y1 && p.y <= y2;
}

function pointRectDistance(px, py, x1, y1, x2, y2) {
	const cx = constrain(px, x1, x2);
	const cy = constrain(py, y1, y2);
	return dist(px, py, cx, cy);
}

function isPointNearPanelForGrab(handObj) {
	if (!handObj || !handObj.pinchPt) return false;
	return isPointInPanelHitbox(handObj.pinchPt);
}

function anyPanelLocked() {
	return !!(dragPanel.leftMagnet || dragPanel.rightMagnet);
}

function isPointNearRectForGrab(handObj, x1, y1, x2, y2) {
	if (!handObj || !handObj.pinchPt) return false;
	return handObj.pinchPt.x >= x1 && handObj.pinchPt.x <= x2 && handObj.pinchPt.y >= y1 && handObj.pinchPt.y <= y2;
}

function tryLockPanelOnPinchStart(handObj) {
	if (!handObj || !isPointNearPanelForGrab(handObj)) return false;
	if (handObj.grabbed) {
		handObj.releaseGrab(false, false, false);
	}
	const lockY = uiConfig.panel.lockY + dragPanel.offsetY;
	const lockX = handObj.pinchPt.x;
	handObj.startUiLockAnimation(createVector(lockX, lockY), () => {
		if (handObj.handSide === "left") {
			dragPanel.leftMagnet = true;
			dragPanel.leftAnchorX = lockX;
			dragPanel.lastLeftY = handObj.trackedPinchPt.y;
		} else {
			dragPanel.rightMagnet = true;
			dragPanel.rightAnchorX = lockX;
			dragPanel.lastRightY = handObj.trackedPinchPt.y;
		}
		dragPanel.engaged = true;
	});
	return true;
}

function tryTriggerUiHitboxOnPinchStart(handObj) {
	if (!handObj || anyPanelLocked()) return false;
	for (let i = 0; i < uiConfig.uiHitboxes.length; i++) {
		const hb = uiConfig.uiHitboxes[i];
		if (!isPointNearRectForGrab(handObj, hb.x1, hb.y1, hb.x2, hb.y2)) {
			continue;
		}
		triggerUiHandler(hb, handObj);
		return true;
	}
	return false;
}

function tryAnimateToolRequiredHitboxFeedback(handObj) {
	if (!handObj || !handObj.pinchPt) return false;
	let nearestDist = Infinity;
	let targetZone = null;
	for (let i = 0; i < grabbables.length; i++) {
		const g = grabbables[i];
		if (!g || !g.active) continue;
		const hb = (interactionModel && g.modelHitboxId) ? interactionModel.hitboxesById.get(g.modelHitboxId) : null;
		if (!hb || !hb.requiredTool) continue;
		const d = vdist(handObj.pinchPt, g.pt);
		if (d <= (g.s * PINCH_TRIGGER_RANGE_SCALE / getWindowScaleFactor()) && d < nearestDist) {
			nearestDist = d;
			targetZone = g;
		}
	}
	if (!targetZone) return false;
	// First mimic a successful grab approach animation (move to hitbox center + shrink),
	// then reject with jitter feedback because the zone requires a tool.
	handObj.startUiLockAnimation(targetZone.pt.copy(), () => {
		handObj.toolRequiredFeedbackLockPt = targetZone.pt.copy();
		handObj.toolRequiredFeedbackPendingUnlock = true;
		handObj.startClawJitter(CLAW_FEEDBACK_JITTER_FRAMES, CLAW_FEEDBACK_JITTER_MAG);
	});
	return true;
}

function triggerUiHandler(hitboxDef, handObj) {
	if (!hitboxDef) return;
	if (typeof hitboxDef.action === "function") {
		hitboxDef.action();
		return;
	}
	const key = hitboxDef.handlerKey || hitboxDef.actionKey;
	if (!key) return;
	if (key === "open_top_bin") {
		triggerBinOpen(0);
		return;
	}
	if (key === "open_bottom_bin") {
		triggerBinOpen(1);
		return;
	}
	if (key === "open_drawer_1") {
		triggerDrawerOpen(0);
		return;
	}
	if (key === "open_drawer_2") {
		triggerDrawerOpen(1);
		return;
	}
	if (key === "open_drawer_3") {
		triggerDrawerOpen(2);
		return;
	}
	if (key === "lock_panel" && handObj) {
		tryLockPanelOnPinchStart(handObj);
	}
}

function getBinDefByIndex(binIdx) {
	return binIdx === 0 ? uiConfig.bins.top : uiConfig.bins.bottom;
}

function isBinOpen(binIdx) {
	return binIdx === 0 ? !!lithiumIsOpen : !!alkalineIsOpen;
}

function setBinOpen(binIdx, openState) {
	if (binIdx === 0) {
		lithiumIsOpen = openState;
	} else {
		alkalineIsOpen = openState;
	}
}

function triggerBinOpen(binIdx) {
	if (!isBinOpen(binIdx)) {
		if (drawerOpen && typeof drawerOpen.play === "function") drawerOpen.play();
		setBinOpen(binIdx, true);
	}
}

function triggerBinClose(binIdx) {
	if (isBinOpen(binIdx)) {
		if (drawerClose && typeof drawerClose.play === "function") drawerClose.play();
		setBinOpen(binIdx, false);
	}
}

function getBinIndexForPoint(p) {
	if (!p) return -1;
	// Pinch-start can happen anywhere inside the bin hitbox;
	// lock animation then snaps toward BIN_LOCK_X.
	if (p.x >= uiConfig.bins.top.x1 && p.x <= uiConfig.bins.top.x2 && p.y >= uiConfig.bins.top.y1 && p.y <= uiConfig.bins.top.y2) return 0;
	if (p.x >= uiConfig.bins.bottom.x1 && p.x <= uiConfig.bins.bottom.x2 && p.y >= uiConfig.bins.bottom.y1 && p.y <= uiConfig.bins.bottom.y2) return 1;
	return -1;
}

function clearBinGrabForSide(side) {
	const key = side === "left" ? "left" : "right";
	binGrabState[key] = null;
}

function tryStartBinGrabOnPinchStart(handObj) {
	if (!handObj || anyPanelLocked()) return false;
	const key = handObj.handSide === "left" ? "left" : "right";
	if (binGrabState[key]) return false;
	const binIdx = getBinIndexForPoint(handObj.pinchPt);
	if (binIdx < 0) return false;
	if (handObj.grabbed) {
		handObj.releaseGrab(false, false, false);
	}
	// Bin lock/open handles are only active while the bin is closed.
	if (isBinOpen(binIdx)) return false;
	const lockY = handObj.pinchPt.y;
	handObj.startUiLockAnimation(createVector(uiConfig.bins.lockX, lockY), () => {
		if (isBinOpen(binIdx)) return;
		binGrabState[key] = {
			binIndex: binIdx,
			lockY,
			lastTrackedPt: handObj.trackedPinchPt.copy(),
			peakSpeed: 0,
			lastSpeed: 0,
			highWhilePinched: false,
			highHoldJittered: false
		};
	});
	return true;
}

function getDrawerDefByIndex(drawerIdx) {
	if (drawerIdx === 0) return uiConfig.drawer.hitboxes[0];
	if (drawerIdx === 1) return uiConfig.drawer.hitboxes[1];
	if (drawerIdx === 2) return uiConfig.drawer.hitboxes[2];
	return null;
}

function getDrawerIndexForToolItemId(toolItemId) {
	if (toolItemId === "tool_scalpel") return 0;
	if (toolItemId === "tool_bonesaw") return 1;
	if (toolItemId === "tool_hammer") return 2;
	return -1;
}

function triggerDrawerOpen(drawerIdx) {
	if (drawerIdx === 0) {
		if (r1isOpen !== 1) {
			if (drawerOpen && typeof drawerOpen.play === "function") drawerOpen.play();
			r1isOpen = 1;
		}
		return;
	}
	if (drawerIdx === 1) {
		if (r2isOpen !== 1) {
			if (drawerOpen && typeof drawerOpen.play === "function") drawerOpen.play();
			r2isOpen = 1;
		}
		return;
	}
	if (drawerIdx === 2) {
		if (r3isOpen !== 1) {
			if (drawerOpen && typeof drawerOpen.play === "function") drawerOpen.play();
			r3isOpen = 1;
		}
	}
}

function drawerStateKeyForSide(side) {
	return side === "left" ? "left" : "right";
}

function clearDrawerGrabForSide(side) {
	drawerGrabState[drawerStateKeyForSide(side)] = null;
}

function forceClawControlToTracked(handObj) {
	if (!handObj || !handObj.trackedPinchPt) return;
	handObj.pinchPt.x = handObj.trackedPinchPt.x;
	handObj.pinchPt.y = handObj.trackedPinchPt.y;
	handObj.clearClawFeedbackState();
	handObj.isUiLockAnimating = false;
	handObj.uiLockTargetPt = null;
	handObj.uiLockOnComplete = null;
	handObj.isUiUnlockReturning = false;
}

function isHandUiLocked(handObj) {
	if (!handObj) return false;
	if (handObj.handSide === "left") {
		return !!dragPanel.leftMagnet || !!drawerGrabState.left || !!binGrabState.left;
	}
	return !!dragPanel.rightMagnet || !!drawerGrabState.right || !!binGrabState.right;
}

function tryStartDrawerGrabOnPinchStart(handObj) {
	if (!handObj || anyPanelLocked()) return false;
	const sideKey = drawerStateKeyForSide(handObj.handSide);
	if (drawerGrabState[sideKey]) return false;
	const defs = uiConfig.drawer.hitboxes;
	const drawerOpenStates = [r1isOpen, r2isOpen, r3isOpen];
	for (let i = 0; i < defs.length; i++) {
		// Original drawer handle hitboxes are only active while drawer is closed.
		if (drawerOpenStates[i] === 1) {
			continue;
		}
		const d = defs[i];
		if (!isPointNearRectForGrab(handObj, d.x1, d.y1, d.x2, d.y2)) {
			continue;
		}
		drawerGrabState[sideKey] = {
			drawerIndex: i,
			lockX: uiConfig.drawer.lockX,
			lockY: d.lockY,
			startTrackedX: handObj.trackedPinchPt.x,
			detaching: false,
			detachFrames: 0
		};
		handObj.startUiLockAnimation(createVector(uiConfig.drawer.lockX, d.lockY), null);
		return true;
	}
	return false;
}

function updateDrawerGrabInteractions() {
	if (!handTracker || !Array.isArray(handTracker.hands)) return;
	if (!getHandBySide("left")) clearDrawerGrabForSide("left");
	if (!getHandBySide("right")) clearDrawerGrabForSide("right");
	for (let i = 0; i < handTracker.hands.length; i++) {
		const h = handTracker.hands[i];
		if (!h) continue;
		const sideKey = drawerStateKeyForSide(h.handSide);
		const st = drawerGrabState[sideKey];
		if (!st) continue;
		if (!h.pinching) {
			clearDrawerGrabForSide(h.handSide);
			continue;
		}

		if (st.detaching) {
			h.pinchPt.x = lerp(h.pinchPt.x, uiConfig.drawer.detachX, uiConfig.drawer.detachLerp);
			// Keep y locked during detach; fully unlock both axes only after animation ends.
			h.pinchPt.y = st.lockY;
			st.detachFrames++;
			if (abs(h.pinchPt.x - uiConfig.drawer.detachX) <= uiConfig.drawer.detachDoneDist || st.detachFrames >= uiConfig.drawer.detachMaxFrames) {
				// Explicit unlock: immediately return claw control to tracked pose.
				forceClawControlToTracked(h);
				h.wasUiLockedLastFrame = false;
				clearDrawerGrabForSide(h.handSide);
			}
			continue;
		}

		h.pinchPt.x = st.lockX;
		h.pinchPt.y = st.lockY;
		const pullDx = st.startTrackedX - h.trackedPinchPt.x; // pull left to open
		if (pullDx >= uiConfig.drawer.pullTriggerDx) {
			triggerDrawerOpen(st.drawerIndex);
			st.detaching = true;
			st.detachFrames = 0;
		}
	}
}

function updateBinGrabInteractions() {
	if (!handTracker || !Array.isArray(handTracker.hands)) return;
	if (!getHandBySide("left")) clearBinGrabForSide("left");
	if (!getHandBySide("right")) clearBinGrabForSide("right");
	for (let i = 0; i < handTracker.hands.length; i++) {
		const h = handTracker.hands[i];
		if (!h) continue;
		const key = h.handSide === "left" ? "left" : "right";
		const st = binGrabState[key];
		if (!st) continue;
		const v = p5.Vector.sub(h.trackedPinchPt, st.lastTrackedPt);
		const speed = v.mag();
		const speedThreshold = scaleSpeedForWindow(uiConfig.bins.openSpeedThreshold);
		st.lastSpeed = speed;
		st.peakSpeed = max(st.peakSpeed, speed);
		st.lastTrackedPt = h.trackedPinchPt.copy();
			if (h.pinching && speed >= speedThreshold) {
				st.highWhilePinched = true;
				// High-speed while held but no release yet: show "not yet" feedback once.
				if (!st.highHoldJittered) {
					h.startClawJitter(CLAW_FEEDBACK_JITTER_FRAMES, CLAW_FEEDBACK_JITTER_MAG);
					triggerBinLidJitter(st.binIndex);
					st.highHoldJittered = true;
				}
			}
		if (!h.pinching) {
			// Mirror small-throw detection style: use sampled tracked velocity history.
			let sampledSpeed = st.lastSpeed;
			let sampledDir = v.copy();
			if (h.velocityHistory && h.velocityHistory.length > 0) {
				const oldestCount = min(THROW_TIER_OLDEST_SAMPLE_COUNT, h.velocityHistory.length);
				let sumSpeed = 0;
				let sumDir = createVector(0, 0);
				for (let j = 0; j < oldestCount; j++) {
					sumSpeed += h.velocityHistory[j].speed;
					sumDir.add(h.velocityHistory[j].v);
				}
				sampledSpeed = sumSpeed / oldestCount;
				sumDir.div(oldestCount);
				sampledDir = sumDir;
			}
			const releasedAtHighSpeed = sampledSpeed >= speedThreshold;
			if (releasedAtHighSpeed) {
				triggerBinOpen(st.binIndex);
				const launchVel = sampledDir.mag() > 0.001 ? sampledDir.copy() : p5.Vector.sub(h.trackedPinchPt, h.pinchPt);
				h.startClawLaunch(launchVel, CLAW_FEEDBACK_LAUNCH_SCALE, CLAW_FEEDBACK_LAUNCH_FRAMES);
				} else {
					// Explicit release with insufficient speed is a failed interaction.
					h.startClawJitter(CLAW_FEEDBACK_JITTER_FRAMES, CLAW_FEEDBACK_JITTER_MAG);
					triggerBinLidJitter(st.binIndex);
				}
			clearBinGrabForSide(h.handSide);
			continue;
		}
		h.pinchPt.x = uiConfig.bins.lockX;
		h.pinchPt.y = st.lockY;
	}
}

function startBinConsume(binKey, g, cx, cy) {
	if (!g) return;
	g.binConsumeActive = true;
	g.binConsumeFrame = 0;
	g.binConsumeStartPt = g.pt.copy();
	g.binConsumeTargetPt = createVector(cx, cy);
	g.binConsumeStartScale = g.currentScale;
	g.binConsumeStartRot = g.currentRotation;
	binConsumeState[binKey] = g;
}

function stepBinConsume(binIdx, binKey) {
	const g = binConsumeState[binKey];
	if (!g) return;
	g.binConsumeFrame++;
	const t = constrain(g.binConsumeFrame / uiConfig.bins.consumeFrames, 0, 1);
	const eased = t * t * (3 - 2 * t);
	g.pt.x = lerp(g.binConsumeStartPt.x, g.binConsumeTargetPt.x, eased * 0.65);
	g.pt.y = lerp(g.binConsumeStartPt.y, g.binConsumeTargetPt.y, eased * 0.65);
	g.currentScale = lerp(g.binConsumeStartScale, 0, t);
	g.currentRotation = g.binConsumeStartRot + (t * 540);
	if (t < 1) return;
	g.binConsumeActive = false;
	g.binConsumeFrame = 0;
	toss(g);
	g.active = false;
	g.visible = false;
	binConsumeState[binKey] = null;
	triggerBinClose(binIdx);
}

function updateBinIntake() {
	const bins = [
		{ idx: 0, key: "top", def: uiConfig.bins.top },
		{ idx: 1, key: "bottom", def: uiConfig.bins.bottom }
	];
	for (let b = 0; b < bins.length; b++) {
		const entry = bins[b];
		if (!isBinOpen(entry.idx)) {
			binConsumeState[entry.key] = null;
			continue;
		}
		if (binConsumeState[entry.key]) {
			stepBinConsume(entry.idx, entry.key);
			continue;
		}
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g || g.isGrabbed || g.binConsumeActive || !g.visible) continue;
			if (g.pt.x < entry.def.x1 || g.pt.x > entry.def.x2 || g.pt.y < entry.def.y1 || g.pt.y > entry.def.y2) continue;
			startBinConsume(entry.key, g, entry.def.centerX, entry.def.centerY);
			break;
		}
	}
}

function maybeDockToolIntoDrawer(toolG) {
	if (!toolG || !toolG.modelItemId || toolG.isGrabbed) return;
	if (!toolG.hasEverBeenPickedUp) return;
	// Latch a release event.
	if (toolG.wasGrabbedLastFrame && !toolG.isGrabbed) {
		toolG.pendingDrawerDock = true;
	}
	if (!toolG.pendingDrawerDock && !toolG.returningToDrawer) return;
	const drawerIdx = getDrawerIndexForToolItemId(toolG.modelItemId);
	if (drawerIdx < 0) return;
	const dd = getDrawerDefByIndex(drawerIdx);
	if (!dd) return;
	const zoneY1 = dd.y1 + uiConfig.drawer.uiYOffset;
	const zoneY2 = dd.y2 + uiConfig.drawer.uiYOffset;
	const withinOpenZone = toolG.pt.x >= uiConfig.drawer.toolDropLeftX && toolG.pt.x <= dd.x2 && toolG.pt.y >= zoneY1 && toolG.pt.y <= zoneY2;

	const isDrawerOpen = (drawerIdx === 0 && r1isOpen === 1) || (drawerIdx === 1 && r2isOpen === 1) || (drawerIdx === 2 && r3isOpen === 1);
	if (!isDrawerOpen) return;

	// Start return-to-drawer animation only if the released tool is in the correct open drawer zone.
	if (!toolG.returningToDrawer) {
		if (!withinOpenZone) return;
		toolG.returningToDrawer = true;
		toolG.returnDrawerIdx = drawerIdx;
		toolG.isThrown = false;
		toolG.throwVelocity.set(0, 0);
		toolG.throwAngularVelocity = 0;
		toolG.endBounceVelocity.set(0, 0);
		toolG.endBounceAngularVelocity = 0;
	}

	toolG.pt.x = lerp(toolG.pt.x, toolG.origX, 0.33);
	toolG.pt.y = lerp(toolG.pt.y, toolG.origY, 0.33);
	toolG.currentScale = lerp(toolG.currentScale, toolG.baseScale, 0.35);
	const arrived = dist(toolG.pt.x, toolG.pt.y, toolG.origX, toolG.origY) <= 10 && abs(toolG.currentScale - toolG.baseScale) <= 0.03;
	if (!arrived) return;

	toss(toolG);
	toolG.visible = false;
	toolG.active = false;
	toolG.isConsumed = false;
	toolG.pendingDrawerDock = false;
	toolG.returningToDrawer = false;
	toolG.returnDrawerIdx = -1;
	if (drawerIdx === 0) {
		scalpelInUse = false;
		r1isOpen = -1;
	} else if (drawerIdx === 1) {
		bonesawInUse = false;
		r2isOpen = -1;
	} else if (drawerIdx === 2) {
		hammerInUse = false;
		r3isOpen = -1;
	}
}

function updateDragPanelInteraction() {
	const stepPanelReturnAnimation = () => {
		if (!dragPanel.returnAnimating) return false;
		dragPanel.returnFrame++;
		const total = max(2, PANEL_RETURN_FRAMES);
		const t = constrain(dragPanel.returnFrame / total, 0, 1);
		const start = dragPanel.returnStartOffsetY;
		const target = dragPanel.initialOffsetY;
		const dir = Math.sign(target - start) || 1;
		const backDist = min(abs(target - start) * 0.5, PANEL_RETURN_BACK_PIXELS);
		const pivot = start - dir * backDist;
		const split = PANEL_RETURN_BACK_RATIO;
		let nextOffset;
		if (t < split) {
			const u = t / split;
			nextOffset = lerp(start, pivot, u);
		} else {
			const u = (t - split) / (1 - split);
			nextOffset = lerp(pivot, target, u);
		}
		dragPanel.offsetY = nextOffset;
		dragPanel.prevOffsetY = nextOffset;
		if (t >= 1 || abs(nextOffset - target) <= 0.5) {
			dragPanel.offsetY = target;
			dragPanel.prevOffsetY = target;
			dragPanel.returnAnimating = false;
		}
		return true;
	};

	const panelLockYNow = uiConfig.panel.lockY + dragPanel.offsetY;
	const shouldReturnToInitial =
		!dragPanel.leftMagnet &&
		!dragPanel.rightMagnet &&
		panelLockYNow <= 300 &&
		abs(dragPanel.offsetY - dragPanel.initialOffsetY) > 0.5;
	if (shouldReturnToInitial && !dragPanel.returnAnimating) {
		dragPanel.returnAnimating = true;
		dragPanel.returnFrame = 0;
		dragPanel.returnStartOffsetY = dragPanel.offsetY;
	}

	const left = getHandBySide("left");
	const right = getHandBySide("right");
	const applyFreeDrift = () => {
		const minOffsetY = -uiConfig.panel.y1;
		const maxOffsetY = h - uiConfig.panel.y2;
		if (abs(dragPanel.velY) > 0.01) {
			dragPanel.offsetY = constrain(dragPanel.offsetY + dragPanel.velY, minOffsetY, maxOffsetY);
			dragPanel.velY *= uiConfig.panel.dragDamp;
			if (dragPanel.offsetY === minOffsetY || dragPanel.offsetY === maxOffsetY) {
				dragPanel.velY = 0;
			}
		}
	};
	if (!left || !right) {
		dragPanel.engaged = false;
		dragPanel.leftMagnet = false;
		dragPanel.rightMagnet = false;
		dragPanel.leftPrevPinch = left ? left.pinching : false;
		dragPanel.rightPrevPinch = right ? right.pinching : false;
		applyFreeDrift();
		if (!stepPanelReturnAnimation()) {
			dragPanel.prevOffsetY = dragPanel.offsetY;
		}
		return;
	}

	if (dragPanel.leftMagnet || dragPanel.rightMagnet) {
		dragPanel.returnAnimating = false;
	}

	const panelDeltaY = dragPanel.offsetY - dragPanel.prevOffsetY;
	if (panelDeltaY !== 0) {
		if (dragPanel.leftMagnet) left.pinchPt.y += panelDeltaY;
		if (dragPanel.rightMagnet) right.pinchPt.y += panelDeltaY;
	}

	// Releasing pinch immediately unlocks that hand and stops panel momentum.
	if (!left.pinching) {
		dragPanel.leftMagnet = false;
	}
	if (!right.pinching) {
		dragPanel.rightMagnet = false;
	}

	dragPanel.engaged = dragPanel.leftMagnet || dragPanel.rightMagnet;

	if (!dragPanel.engaged) {
		applyFreeDrift();
		if (!stepPanelReturnAnimation()) {
			dragPanel.prevOffsetY = dragPanel.offsetY;
		}
		dragPanel.leftPrevPinch = left.pinching;
		dragPanel.rightPrevPinch = right.pinching;
		return;
	}

	if (dragPanel.leftMagnet && dragPanel.rightMagnet) {
		dragPanel.baseSpacing = dragPanel.rightAnchorX - dragPanel.leftAnchorX;
	}

	const targetY = uiConfig.panel.lockY + dragPanel.offsetY;
	if (dragPanel.leftMagnet) {
		left.pinchPt.x = dragPanel.leftAnchorX;
		left.pinchPt.y = targetY;
		if (left.grabbed) left.grabbed.ud(left.getClawControlPt(), left.handSide);
	}
	if (dragPanel.rightMagnet) {
		right.pinchPt.x = dragPanel.rightAnchorX;
		right.pinchPt.y = targetY;
		if (right.grabbed) right.grabbed.ud(right.getClawControlPt(), right.handSide);
	}

	const dyL = left.trackedPinchPt.y - dragPanel.lastLeftY;
	const dyR = right.trackedPinchPt.y - dragPanel.lastRightY;
	dragPanel.lastLeftY = left.trackedPinchPt.y;
	dragPanel.lastRightY = right.trackedPinchPt.y;

	const sameDirection = (dyL > 0 && dyR > 0) || (dyL < 0 && dyR < 0);
	const minSpeed = min(abs(dyL), abs(dyR));
	const avgSpeed = (abs(dyL) + abs(dyR)) * 0.5;
	const combinedDy = dyL + dyR;
	const speedThreshold = scaleSpeedForWindow(uiConfig.panel.moveSpeedThreshold);

	// Panel moves up/down from combined tracked intent; hands do not need strict alignment.
	const combinedIntent = dragPanel.leftMagnet && dragPanel.rightMagnet && left.pinching && right.pinching;
	const combinedSpeed = abs(combinedDy) * 0.5;
	if (combinedIntent && combinedSpeed >= speedThreshold) {
		const dir = combinedDy > 0 ? 1 : -1;
		const drive = max(minSpeed, avgSpeed * 0.75);
		dragPanel.velY = constrain(dir * drive, -uiConfig.panel.dragMaxSpeed, uiConfig.panel.dragMaxSpeed);
	} else {
		dragPanel.velY *= uiConfig.panel.dragDamp;
		// Feedback when one hand attempts to move but pair sync conditions are not met.
		const lAttempt = dragPanel.leftMagnet && left.pinching && abs(dyL) >= scaleSpeedForWindow(PANEL_FAIL_JITTER_SPEED);
		const rAttempt = dragPanel.rightMagnet && right.pinching && abs(dyR) >= scaleSpeedForWindow(PANEL_FAIL_JITTER_SPEED);
		const bothLocked = dragPanel.leftMagnet && dragPanel.rightMagnet;
		if (!bothLocked) {
			if (lAttempt) {
				left.startClawJitter(CLAW_FEEDBACK_JITTER_FRAMES, CLAW_FEEDBACK_JITTER_MAG * 0.7);
				triggerPanelJitter();
			}
			if (rAttempt) {
				right.startClawJitter(CLAW_FEEDBACK_JITTER_FRAMES, CLAW_FEEDBACK_JITTER_MAG * 0.7);
				triggerPanelJitter();
			}
		} else if (!(combinedSpeed >= speedThreshold)) {
			if (abs(dyL) > abs(dyR) + scaleSpeedForWindow(1.2) && lAttempt) {
				left.startClawJitter(CLAW_FEEDBACK_JITTER_FRAMES, CLAW_FEEDBACK_JITTER_MAG * 0.55);
				triggerPanelJitter();
			}
			if (abs(dyR) > abs(dyL) + scaleSpeedForWindow(1.2) && rAttempt) {
				right.startClawJitter(CLAW_FEEDBACK_JITTER_FRAMES, CLAW_FEEDBACK_JITTER_MAG * 0.55);
				triggerPanelJitter();
			}
		}
	}

	const minOffsetY = -uiConfig.panel.y1;
	const maxOffsetY = h - uiConfig.panel.y2;
	dragPanel.offsetY = constrain(dragPanel.offsetY + dragPanel.velY, minOffsetY, maxOffsetY);
	if (dragPanel.offsetY === minOffsetY || dragPanel.offsetY === maxOffsetY) {
		dragPanel.velY = 0;
	}
	const atBoundNow = (dragPanel.offsetY === minOffsetY || dragPanel.offsetY === maxOffsetY);
	if (atBoundNow && !dragPanel.wasAtVerticalBound) {
		triggerPanelJitter();
	}
	dragPanel.wasAtVerticalBound = atBoundNow;
	dragPanel.prevOffsetY = dragPanel.offsetY;
	dragPanel.leftPrevPinch = left.pinching;
	dragPanel.rightPrevPinch = right.pinching;
}

function getToolAngleForSide(side) {
	return side === "left" ? toolConfig.leftToolAngle : toolConfig.rightToolAngle;
}

function getToolPreviewAngleOffsetForSide(side, previewT) {
	if (previewT <= 0) return 0;
	// Right hand: counterclockwise (+deg). Left hand: clockwise (-deg).
	const dir = side === "left" ? 1 : -1;
	return dir * toolConfig.toolPreviewAngleDeltaDeg * previewT;
}

function getHeldToolTipPoint(toolObj, handSide) {
	if (!toolObj || !toolObj.pic || !toolObj.visible) {
		return null;
	}
	// Match render transform order: rotate(currentRotation) then local mirror for left tool.
	// Compute local forward axis first, mirror locally if left, then rotate to world.
	const rotDeg = toolObj.currentRotation;
	const len = toolObj.s * 1.5;
	let localX = cos(toolConfig.tipAxisOffsetDeg);
	const localY = sin(toolConfig.tipAxisOffsetDeg);
	if (handSide === "left") {
		localX *= -1;
	}
	const dirX = localX * cos(rotDeg) - localY * sin(rotDeg);
	const dirY = localX * sin(rotDeg) + localY * cos(rotDeg);
	return createVector(
		toolObj.pt.x + dirX * len,
		toolObj.pt.y + dirY * len
	);
}

class tracker{
	constructor() {
		this.hands = [];
		this.seenThisFrame = [];
	}
	getPinchPt(i){
		return this.hands[i].pinchPt
	}
	beginFrame() {
		this.seenThisFrame = new Array(this.hands.length).fill(false);
	}
	upsertHand(hand){
		const side = inferHandSide(hand);
		const wrist = mapTrackedPoint(hand.keypoints[ML5HAND_WRIST].x, hand.keypoints[ML5HAND_WRIST].y);
		let bestIdx = -1;
		let bestDist = Infinity;
		for (let i = 0; i < this.hands.length; i++) {
			if (this.hands[i].handSide !== side) {
				continue;
			}
			const d = vdist(this.hands[i].av, wrist);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}

		if (bestIdx >= 0 && bestDist < 260) {
			this.hands[bestIdx].updateFromDetection(hand);
			this.seenThisFrame[bestIdx] = true;
			return;
		}
		if (bestIdx >= 0) {
			this.hands[bestIdx].updateFromDetection(hand);
			this.seenThisFrame[bestIdx] = true;
			return;
		}

		if (this.hands.length < HAND_MAX) {
			const hTrack = new oneHand(hand, this.hands.length);
			this.hands.push(hTrack);
			this.seenThisFrame.push(true);
			return;
		}

		let oldestIdx = -1;
		let maxMiss = -1;
		for (let i = 0; i < this.hands.length; i++) {
			if (this.hands[i].handSide !== side) {
				continue;
			}
			if (this.hands[i].missedFrames > maxMiss) {
				maxMiss = this.hands[i].missedFrames;
				oldestIdx = i;
			}
		}
		if (oldestIdx < 0) {
			oldestIdx = 0;
		}
		this.hands[oldestIdx] = new oneHand(hand, oldestIdx);
		this.seenThisFrame[oldestIdx] = true;
	}
	endFrame() {
		for (let i = this.hands.length - 1; i >= 0; i--) {
			if (!this.seenThisFrame[i]) {
				this.hands[i].stepNoDetection();
			}
		}
	}
	ud() {
		for (let i=0; i<this.hands.length; i++){
			this.hands[i].ud()
		}
	}
	display() {
		strokeWeight(10)
		for (let i = 0; i < this.hands.length; i++) {
			let hand = this.hands[i];
			for (let j = 0; j < hand.hand.keypoints.length; j++) {
				let keypoint = hand.hand.keypoints[j];
				fill(0,255,0);
				noStroke();
				circle(keypoint.x*wratio, keypoint.y*hratio, 10);
				// if (j==ML5HAND_THUMB_TIP)
			}	
		}
	}
}

class oneHand {
	constructor(hand, num){
		this.hand = hand
		this.handSide = inferHandSide(hand);
		this.av = createVector(0, 0);
		this.num = num;
		this.offscreenPt = getOffscreenPinch(this.handSide);
		this.homePt = getHomePinch(this.handSide);
		this.thumbTip = this.offscreenPt.copy();
		this.indexTip = this.offscreenPt.copy();
		this.pinchPt = this.offscreenPt.copy();
		this.trackedPinchPt = this.offscreenPt.copy();
		this.prevPinchPt = this.offscreenPt.copy();
		this.prevTrackedPinchPt = this.offscreenPt.copy();
		this.velocity = createVector(0, 0);
		this.lastLiveVelocity = createVector(0, 0);
		this.lostStartVelocity = createVector(0, 0);
		this.clawSpeed = 0;
		this.velocityHistory = [];
		this.pinching = false;
		this.pinchHold = 0;
		this.grabbed = null;
		this.currentPinchGeneration = 0;
		this.mustOpenBeforeNextInteraction = false;
		this.zigProgress = 0;
		this.missedFrames = 0;
		this.latestGrabbed = null;
		this.retreatStartPt = this.offscreenPt.copy();
		this.lastDetectionMs = millis();
		this.reconnectGrabCooldown = 0;
		this.isPickupAnimating = false;
		this.pickupTargetObj = null;
		this.pickupStage = 0;
		this.isUiLockAnimating = false;
		this.uiLockTargetPt = null;
		this.uiLockOnComplete = null;
		this.isUiUnlockReturning = false;
		this.wasUiLockedLastFrame = false;
		this.clawScale = 1;
		this.renderPinchOffset = createVector(0, 0);
		this.feedbackMode = null; // null | "jitter" | "launch"
		this.feedbackFrame = 0;
		this.feedbackTotalFrames = 0;
		this.feedbackMag = 0;
		this.feedbackLaunchVel = createVector(0, 0);
		this.feedbackBaseScale = 1;
		this.feedbackLaunchOffset = createVector(0, 0);
		this.grabReach = s;
		this.debugToolTip = null;
		this.debugToolHits = [];
		this.prevToolTip = null;
		this.toolTipSpeed = 0;
		this.cutGestureByHitboxId = new Map();
		this.lastHeldToolItemId = null;
		this.toolPreviewChunkSum = 0;
		this.toolPreviewChunkCount = 0;
		this.toolPreviewGoodChunks = 0;
		this.toolPreviewBadChunks = 0;
		this.toolPreviewActive = false;
		this.toolPreviewT = 0;
		this.toolRequiredFeedbackLockPt = null;
		this.toolRequiredFeedbackPendingUnlock = false;
		this.updateFromDetection(hand);
	}
	
	getAv(){
		let sumx = 0
		let sumy = 0
		let len = this.hand.keypoints.length
    for (let j = 0; j < len; j++) {
      let keypoint = this.hand.keypoints[j];
      const kp = mapTrackedPoint(keypoint.x, keypoint.y);
      sumx += kp.x
			sumy += kp.y
  	}
		this.av = createVector(sumx/len,sumy/len)
	}
	getClawControlPt() {
		// Single source of truth for where a grabbed object should follow.
		return this.pinchPt;
	}
	getRenderPinchPt() {
		if (!this.feedbackMode) {
			return this.pinchPt.copy();
		}
		return createVector(this.pinchPt.x + this.renderPinchOffset.x, this.pinchPt.y + this.renderPinchOffset.y);
	}
	clearClawFeedbackState() {
		this.feedbackMode = null;
		this.feedbackFrame = 0;
		this.feedbackTotalFrames = 0;
		this.feedbackMag = 0;
		this.feedbackLaunchVel.set(0, 0);
		this.feedbackLaunchOffset.set(0, 0);
		this.renderPinchOffset.set(0, 0);
		this.toolRequiredFeedbackLockPt = null;
		this.toolRequiredFeedbackPendingUnlock = false;
	}
	startClawJitter(frames = CLAW_FEEDBACK_JITTER_FRAMES, mag = CLAW_FEEDBACK_JITTER_MAG) {
		if (this.feedbackMode === "launch") return;
		this.feedbackMode = "jitter";
		this.feedbackFrame = 0;
		this.feedbackTotalFrames = max(1, int(frames));
		this.feedbackMag = mag;
	}
	startClawLaunch(rawVel, targetScale = CLAW_FEEDBACK_LAUNCH_SCALE, frames = CLAW_FEEDBACK_LAUNCH_FRAMES) {
		const v = rawVel ? rawVel.copy() : createVector(0, 0);
		if (v.mag() < 0.001) {
			v.set(this.handSide === "left" ? -1 : 1, 0);
		}
		v.normalize();
		v.mult(scaleDistanceForWindow(42));
		this.feedbackMode = "launch";
		this.feedbackFrame = 0;
		this.feedbackTotalFrames = max(2, int(frames));
		this.feedbackLaunchVel = v;
		this.feedbackBaseScale = max(1, targetScale);
		this.feedbackLaunchOffset.set(0, 0);
		this.isUiUnlockReturning = false;
	}
	updateClawFeedbackAnimation() {
		this.renderPinchOffset.set(0, 0);
		if (!this.feedbackMode) return false;
		if (this.feedbackMode === "jitter") {
			this.feedbackFrame++;
			const t = constrain(this.feedbackFrame / this.feedbackTotalFrames, 0, 1);
			const fade = (1 - t);
			this.renderPinchOffset.set((random() * 2 - 1) * this.feedbackMag * fade, (random() * 2 - 1) * this.feedbackMag * fade);
			if (this.feedbackFrame >= this.feedbackTotalFrames) {
				this.feedbackMode = null;
				this.renderPinchOffset.set(0, 0);
				if (this.toolRequiredFeedbackPendingUnlock) {
					this.toolRequiredFeedbackPendingUnlock = false;
					this.toolRequiredFeedbackLockPt = null;
					this.isUiUnlockReturning = true;
				}
			}
			return false;
		}
		if (this.feedbackMode === "launch") {
			this.feedbackFrame++;
			const t = constrain(this.feedbackFrame / this.feedbackTotalFrames, 0, 1);
			const pushCurve = sin(t * PI); // forward then back
			this.feedbackLaunchOffset = p5.Vector.mult(this.feedbackLaunchVel, pushCurve);
			this.renderPinchOffset = this.feedbackLaunchOffset.copy();
			this.clawScale = lerp(this.clawScale, this.feedbackBaseScale, 0.45);
			if (t >= 1) {
				this.feedbackMode = null;
				this.feedbackLaunchOffset.set(0, 0);
				this.renderPinchOffset.set(0, 0);
				this.isUiUnlockReturning = true;
			}
			return false;
		}
		return false;
	}
	startPickupAnimation(targetObj) {
		this.isPickupAnimating = true;
		this.pickupTargetObj = targetObj;
		this.pickupStage = 1;
	}
	startUiLockAnimation(targetPt, onComplete) {
		if (!targetPt) return;
		this.isUiLockAnimating = true;
		this.uiLockTargetPt = targetPt.copy();
		this.uiLockOnComplete = (typeof onComplete === "function") ? onComplete : null;
	}
	updateUiLockAnimation() {
		if (!this.isUiLockAnimating || !this.uiLockTargetPt) {
			return false;
		}
		this.clawScale = lerp(this.clawScale, CLAW_PICKUP_SHRINK_SCALE, CLAW_SCALE_LERP);
		this.pinchPt = p5.Vector.lerp(this.pinchPt, this.uiLockTargetPt, PICKUP_TO_OBJECT_LERP);
		if (vdist(this.pinchPt, this.uiLockTargetPt) <= scaleDistanceForWindow(PICKUP_ATTACH_DIST)) {
			this.pinchPt = this.uiLockTargetPt.copy();
			this.isUiLockAnimating = false;
			const cb = this.uiLockOnComplete;
			this.uiLockOnComplete = null;
			this.uiLockTargetPt = null;
			if (cb) cb();
			if (!isHandUiLocked(this) && !this.toolRequiredFeedbackPendingUnlock) {
				forceClawControlToTracked(this);
			}
		}
		return true;
	}
	updatePickupAnimation() {
		if (!this.isPickupAnimating || !this.pickupTargetObj) {
			return false;
		}
		if (this.pickupStage === 1) {
			// Move claw toward object first; ignore live tracking in this phase.
			this.clawScale = lerp(this.clawScale, CLAW_PICKUP_SHRINK_SCALE, CLAW_SCALE_LERP);
			this.pinchPt = p5.Vector.lerp(this.pinchPt, this.pickupTargetObj.pt, PICKUP_TO_OBJECT_LERP);
			if (vdist(this.pinchPt, this.pickupTargetObj.pt) <= scaleDistanceForWindow(PICKUP_ATTACH_DIST)) {
				this.grabbed = this.pickupTargetObj;
				this.latestGrabbed = this.pickupTargetObj;
				this.pickupStage = 2;
			}
		}
		if (this.pickupStage === 2) {
			// After attach, interpolate claw back to tracked position.
			this.clawScale = lerp(this.clawScale, 1, CLAW_SCALE_LERP);
			this.pinchPt = p5.Vector.lerp(this.pinchPt, this.trackedPinchPt, PICKUP_RETURN_LERP);
			if (this.grabbed != null) {
				this.grabbed.ud(this.getClawControlPt(), this.handSide);
			}
			if (vdist(this.pinchPt, this.trackedPinchPt) <= scaleDistanceForWindow(PICKUP_RETURN_DIST)) {
				this.isPickupAnimating = false;
				this.pickupTargetObj = null;
				this.pickupStage = 0;
			}
		}
		return true;
	}
	releaseGrab(resetLatestGrabbed = false, allowThrow = false, forceUnpinch = true) {
		if (this.grabbed != null) {
			if (allowThrow && this.grabbed.pic != null) {
				let avgTrackedSpeed = 0;
				let sampledSpeed = 0;
				let avgTrackedDir = createVector(0, 0);
				if (this.velocityHistory.length > 0) {
					const oldestCount = min(THROW_TIER_OLDEST_SAMPLE_COUNT, this.velocityHistory.length);
					for (let i = 0; i < oldestCount; i++) {
						avgTrackedSpeed += this.velocityHistory[i].speed;
						avgTrackedDir.add(this.velocityHistory[i].v);
					}
					avgTrackedSpeed /= oldestCount;
					avgTrackedDir.div(oldestCount);
					sampledSpeed = avgTrackedSpeed;
				} else {
					sampledSpeed = this.clawSpeed;
				}
				const dir = this.velocityHistory.length > 0 ? avgTrackedDir.copy() : this.velocity.copy();
				const motionMag = dir.mag();
				if (motionMag > 0.0001) {
					dir.normalize();
					if (sampledSpeed >= scaleSpeedForWindow(THROW_BIG_THRESHOLD)) {
						this.grabbed.startThrow(p5.Vector.mult(dir, scaleSpeedForWindow(THROW_BIG_SPEED)));
					} else if (sampledSpeed >= scaleSpeedForWindow(THROW_SMALL_THRESHOLD)) {
						this.grabbed.startThrow(p5.Vector.mult(dir, scaleSpeedForWindow(THROW_SMALL_SPEED)));
					}
				}
			}
			this.grabbed.isGrabbed = false;
			this.grabbed = null;
		}
		if (forceUnpinch) {
			this.pinching = false;
			this.pinchHold = 0;
		}
		// One interaction per pinch: even soft-release needs open->close before next interaction.
		this.mustOpenBeforeNextInteraction = true;
		this.isPickupAnimating = false;
		this.pickupTargetObj = null;
		this.pickupStage = 0;
		this.isUiLockAnimating = false;
		this.uiLockTargetPt = null;
		this.uiLockOnComplete = null;
		this.isUiUnlockReturning = false;
		if (resetLatestGrabbed) {
			this.latestGrabbed = null;
		}
		this.clearClawFeedbackState();
	}
	updateFromDetection(hand) {
		const wasMissing = this.missedFrames > 0;
		this.hand = hand;
		this.missedFrames = 0;
		this.lastDetectionMs = millis();
		this.handSide = inferHandSide(hand);
		this.homePt = getHomePinch(this.handSide);
		this.offscreenPt = getOffscreenPinch(this.handSide);
		this.retreatStartPt = this.pinchPt.copy();
		const targetThumb = mapTrackedPoint(hand.keypoints[ML5HAND_THUMB_TIP].x, hand.keypoints[ML5HAND_THUMB_TIP].y);
		const targetIndex = mapTrackedPoint(hand.keypoints[ML5HAND_INDEX_FINGER_TIP].x, hand.keypoints[ML5HAND_INDEX_FINGER_TIP].y);
		const rawPinch = mid(targetThumb, targetIndex);
		const targetPinch = rawPinch.copy();
		const prevPinch = this.pinchPt.copy();
		const delta = p5.Vector.sub(targetPinch, prevPinch);
		const deltaMag = delta.mag();
		if (deltaMag > MAX_TRACK_JUMP) {
			delta.setMag(MAX_TRACK_JUMP);
			targetPinch.set(prevPinch.x + delta.x, prevPinch.y + delta.y);
			const shift = p5.Vector.sub(targetPinch, rawPinch);
			targetThumb.add(shift);
			targetIndex.add(shift);
		}

		this.thumbTip = p5.Vector.lerp(this.thumbTip, targetThumb, HAND_SMOOTH_ALPHA);
		this.indexTip = p5.Vector.lerp(this.indexTip, targetIndex, HAND_SMOOTH_ALPHA);
		const trackedVel = p5.Vector.sub(targetPinch, this.prevTrackedPinchPt);
		this.prevTrackedPinchPt = targetPinch.copy();
		this.trackedPinchPt = p5.Vector.lerp(this.trackedPinchPt, targetPinch, HAND_SMOOTH_ALPHA);
		const clawMotionOwnedByAnimation =
			this.isPickupAnimating ||
			this.isUiLockAnimating ||
			this.isUiUnlockReturning ||
			this.feedbackMode === "launch";
		if (!clawMotionOwnedByAnimation) {
			this.pinchPt = this.trackedPinchPt.copy();
		}
		this.velocity = p5.Vector.lerp(this.velocity, p5.Vector.sub(this.pinchPt, prevPinch), 0.5);
		this.lastLiveVelocity = this.velocity.copy();
		this.clawSpeed = p5.Vector.dist(this.pinchPt, prevPinch);
		this.velocityHistory.push({ v: trackedVel.copy(), speed: trackedVel.mag() });
		if (this.velocityHistory.length > THROW_VELOCITY_HISTORY_SIZE) {
			this.velocityHistory.shift();
		}
		this.prevPinchPt = prevPinch;

		this.getAv();
		const wrist = mapTrackedPoint(hand.keypoints[ML5HAND_WRIST].x, hand.keypoints[ML5HAND_WRIST].y);
		this.av = p5.Vector.lerp(this.av, wrist, 0.3);
		if (wasMissing) {
			this.releaseGrab(true);
			this.reconnectGrabCooldown = RECONNECT_GRAB_COOLDOWN_FRAMES;
		}
	}
	stepNoDetection() {
		this.missedFrames++;
		this.releaseGrab(true);
		this.velocity.mult(0.7);
		if (this.missedFrames === 1) {
			this.retreatStartPt = this.pinchPt.copy();
			this.lostStartVelocity = this.lastLiveVelocity.copy();
		}
		if (this.offscreenPt && this.retreatStartPt) {
			const prevPt = this.pinchPt.copy();
			const tRaw = constrain(this.missedFrames / OFFSCREEN_RETREAT_FRAMES, 0, 1);
			const xEase = pow(tRaw, 1.35);
			const yEase = pow(tRaw, 1.2);

			const baseX = lerp(this.retreatStartPt.x, this.offscreenPt.x, xEase);
			const baseY = lerp(this.retreatStartPt.y, this.offscreenPt.y, yEase);
			const bow = OFFSCREEN_ARC_BOW * sin(PI * tRaw);
			const arcDir = this.handSide === "left" ? -1 : 1;
			const offscreenTarget = createVector(baseX, baseY - (bow * arcDir * 0.35));
			const momentumScale = (tRaw * OFFSCREEN_RETREAT_FRAMES) * (1 - 0.35 * tRaw);
			const momentumPt = p5.Vector.add(this.retreatStartPt, p5.Vector.mult(this.lostStartVelocity, momentumScale));
			const blendToTarget = pow(tRaw, 1.25);
			const blendedPt = p5.Vector.lerp(momentumPt, offscreenTarget, blendToTarget);

			this.pinchPt.x = blendedPt.x;
			this.pinchPt.y = blendedPt.y;
			this.clawSpeed = p5.Vector.dist(this.pinchPt, prevPt);
		}
		this.thumbTip = p5.Vector.lerp(this.thumbTip, this.pinchPt, 0.3);
		this.indexTip = p5.Vector.lerp(this.indexTip, this.pinchPt, 0.3);
		if (this.missedFrames > MAX_MISSED_FRAMES) {
			this.pinching = false;
			this.pinchHold = 0;
		}
	}
	ud(){
		if (!this.hand) {
			return;
		}
		// Safety: never keep a stale visual offset if feedback mode is inactive.
		if (!this.feedbackMode) {
			this.renderPinchOffset.set(0, 0);
		}
		if (millis() - this.lastDetectionMs > HAND_STALE_MS) {
			this.stepNoDetection();
			return;
		}
		if (this.missedFrames > 0) {
			return;
		}
		if (this.pinchPt.x < 0 || this.pinchPt.x > w || this.pinchPt.y < 0 || this.pinchPt.y > h) {
			this.releaseGrab(false);
			return;
		}
		const wrist = this.hand.keypoints[ML5HAND_WRIST];
		const middleMcp = this.hand.keypoints[ML5HAND_MIDDLE_FINGER_MCP];
		const wristPt = mapTrackedPoint(wrist.x, wrist.y);
		const middleMcpPt = mapTrackedPoint(middleMcp.x, middleMcp.y);
		const palmScale = max(18, dist(wristPt.x, wristPt.y, middleMcpPt.x, middleMcpPt.y));
		const pinchDistance = vdist(this.thumbTip, this.indexTip);
		const pinchRatio = pinchDistance / palmScale;
		const wasPinching = this.pinching;
		if (pinchRatio > PINCH_OPEN_RATIO) {
			this.mustOpenBeforeNextInteraction = false;
		}
		this.grabReach = s;
		if (zigmode) this.checkzig()

		if (!this.pinching && !this.mustOpenBeforeNextInteraction && pinchRatio < PINCH_CLOSE_RATIO) {
			this.pinchHold++;
			if (this.pinchHold >= PINCH_HOLD_FRAMES) {
				this.pinching = true;
				this.pinchHold = PINCH_HOLD_FRAMES;
			}
		} else if (this.pinching && pinchRatio > PINCH_OPEN_RATIO) {
			this.releaseGrab(false, true, true);
		} else {
			this.pinchHold = max(0, this.pinchHold - 1);
		}
		// Safety: if not pinching and not actively locking, ensure we are not stuck in lock animation.
		if (!this.pinching && !isHandUiLocked(this)) {
			this.isUiLockAnimating = false;
			this.uiLockTargetPt = null;
			this.uiLockOnComplete = null;
		}
		const uiLockedNow = isHandUiLocked(this);
		if (this.wasUiLockedLastFrame && !uiLockedNow && !this.toolRequiredFeedbackPendingUnlock) {
			this.isUiUnlockReturning = true;
		}
		this.wasUiLockedLastFrame = uiLockedNow;
		if (this.reconnectGrabCooldown > 0) {
			this.reconnectGrabCooldown--;
		}
		if (!this.isPickupAnimating && !this.isUiLockAnimating && !uiLockedNow) {
			this.clawScale = lerp(this.clawScale, 1, CLAW_SCALE_LERP);
		}
		if (this.updateUiLockAnimation()) {
			return;
		}
		if (this.toolRequiredFeedbackPendingUnlock && this.toolRequiredFeedbackLockPt) {
			this.pinchPt.x = this.toolRequiredFeedbackLockPt.x;
			this.pinchPt.y = this.toolRequiredFeedbackLockPt.y;
			this.clawScale = lerp(this.clawScale, CLAW_PICKUP_SHRINK_SCALE, CLAW_SCALE_LERP);
		}
		const feedbackOwnsMotion = this.updateClawFeedbackAnimation();
		if (this.isUiUnlockReturning) {
			this.pinchPt = p5.Vector.lerp(this.pinchPt, this.trackedPinchPt, PICKUP_RETURN_LERP);
			this.clawScale = lerp(this.clawScale, 1, CLAW_SCALE_LERP);
			if (vdist(this.pinchPt, this.trackedPinchPt) <= scaleDistanceForWindow(PICKUP_RETURN_DIST)) {
				this.isUiUnlockReturning = false;
			}
		}
		if (feedbackOwnsMotion) {
			return;
		}
		const previewTarget = this.toolPreviewActive ? 1 : 0;
		this.toolPreviewT = lerp(this.toolPreviewT, previewTarget, 0.7);
		if (this.grabbed && isToolItem(this.grabbed.itemID)) {
			const previewScaleTarget = lerp(1, toolConfig.toolPreviewClawScale, this.toolPreviewT);
			this.clawScale = lerp(this.clawScale, previewScaleTarget, 0.7);
		}
		const justPinched = (!wasPinching && this.pinching);
		if (justPinched) {
			globalPinchGeneration++;
			this.currentPinchGeneration = globalPinchGeneration;
		}

		// Exclusive pinch target resolution: panel > drawers > bins > ui > object.
		let pinchTargetResolved = false;
		if (this.reconnectGrabCooldown <= 0 && justPinched && this.grabbed == null && !this.isPickupAnimating) {
			if (tryLockPanelOnPinchStart(this)) {
				pinchTargetResolved = true;
			} else if (tryStartDrawerGrabOnPinchStart(this)) {
				pinchTargetResolved = true;
			} else if (tryStartBinGrabOnPinchStart(this)) {
				pinchTargetResolved = true;
			} else if (tryTriggerUiHitboxOnPinchStart(this)) {
				pinchTargetResolved = true;
			}
		}

		if (!pinchTargetResolved && !anyPanelLocked() && this.reconnectGrabCooldown <= 0 && justPinched && this.grabbed == null && !this.isPickupAnimating){
			let currClosestD = w;
			let currClosest = null;
			for (let i=0; i<grabbables.length; i++){
				let g = grabbables[i]
				if (!g.active) {
					continue;
				}
				const hb = (interactionModel && g.modelHitboxId) ? interactionModel.hitboxesById.get(g.modelHitboxId) : null;
				if (hb && hb.mode && hb.mode !== "grab") {
					continue;
				}
				if (g.minPinchGeneration > this.currentPinchGeneration) {
					continue;
				}
				let d = vdist(this.pinchPt,g.pt)
				if (d<(g.s * PINCH_TRIGGER_RANGE_SCALE / getWindowScaleFactor()) && d<=currClosestD){
					currClosestD = d
					currClosest = g
				}
			}
			if (currClosest != null) {
				this.startPickupAnimation(currClosest);
				pinchTargetResolved = true;
			} else if (tryAnimateToolRequiredHitboxFeedback(this)) {
				// Only error-feedback if no regular grabbable pickup was possible.
				pinchTargetResolved = true;
			}
        }

		if (this.updatePickupAnimation()) {
			return;
		}
		this.updateToolGestureInteractions();

		if (this.grabbed != null && !this.grabbed.active) {
			// Consumed placeholders should release immediately.
			this.releaseGrab(false, false, false);
			return;
		}

		if (this.pinching && this.grabbed != null){
			this.grabbed.ud(this.getClawControlPt(), this.handSide);
		}
		this.updateDebugToolInteraction();
}
	updateDebugToolInteraction() {
		this.debugToolTip = null;
		this.debugToolHits = [];
		if (!this.grabbed || !isToolItem(this.grabbed.itemID)) {
			return;
		}
		const tip = getHeldToolTipPoint(this.grabbed, this.handSide);
		this.debugToolTip = tip;
		if (!tip) {
			return;
		}
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g || g === this.grabbed || !g.active) {
				continue;
			}
			const interactionRadius = g.s * toolConfig.interactionRadiusFactor;
			if (vdist(tip, g.pt) <= interactionRadius) {
				this.debugToolHits.push(g);
			}
		}
	}
	updateToolGestureInteractions() {
		const heldTool = this.grabbed;
		if (!heldTool || !isToolItem(heldTool.itemID) || !this.pinching) {
			this.lastHeldToolItemId = null;
			this.prevToolTip = null;
			this.toolTipSpeed = 0;
			this.toolPreviewChunkSum = 0;
			this.toolPreviewChunkCount = 0;
			this.toolPreviewGoodChunks = 0;
			this.toolPreviewBadChunks = 0;
			this.toolPreviewActive = false;
			return;
		}
		const tip = getHeldToolTipPoint(heldTool, this.handSide);
		if (!tip) {
			this.prevToolTip = null;
			this.toolTipSpeed = 0;
			return;
		}
		this.toolTipSpeed = this.prevToolTip ? p5.Vector.dist(tip, this.prevToolTip) : 0;
		this.prevToolTip = tip.copy();
		const toolItemId = heldTool.modelItemId || null;
		const justPickedUpTool = this.lastHeldToolItemId !== toolItemId;
		this.lastHeldToolItemId = toolItemId;
		const chunkFrames = max(1, int(toolConfig.toolVelocityChunkFrames || 4));
		const requiredChunks = max(1, int(toolConfig.toolSustainChunksRequired || 3));
		const scalpelMin = scaleSpeedForWindow(toolConfig.cutScalpelMinSpeed);
		const scalpelMax = scaleSpeedForWindow(toolConfig.cutScalpelMaxSpeed);
		const bonesawMin = scaleSpeedForWindow(toolConfig.cutBonesawMinSpeed);
		const hammerMin = scaleSpeedForWindow(toolConfig.cutHammerMinSpeed);
		const isSpeedMatch = (speedVal) => {
			if (toolItemId === "tool_scalpel") {
				return speedVal >= scalpelMin && speedVal <= scalpelMax;
			}
			if (toolItemId === "tool_bonesaw") {
				return speedVal > bonesawMin;
			}
			if (toolItemId === "tool_hammer") {
				return speedVal > hammerMin;
			}
			return false;
		};
		if (justPickedUpTool && typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
			print("[TOOL_PICKED_UP]", {
				toolItemId: toolItemId,
				pinching: this.pinching
			});
		}
		for (const [hbId, hb] of interactionModel.hitboxesById.entries()) {
			const zoneG = grabbables[hb.grabbableIndex];
			if (!zoneG || !zoneG.active || zoneG.isConsumed) {
				continue;
			}
			let state = this.cutGestureByHitboxId.get(hbId);
			if (!state) {
				state = {
					armed: false, peak: 0, cooldown: 0, debugArmed: false, debugPeak: 0,
					chunkSum: 0, chunkCount: 0, goodChunks: 0,
					debugChunkSum: 0, debugChunkCount: 0, debugGoodChunks: 0
				};
				this.cutGestureByHitboxId.set(hbId, state);
			}
			if (state.cooldown > 0) {
				state.cooldown--;
				continue;
			}
			const inZone = vdist(tip, zoneG.pt) <= (zoneG.s * toolConfig.interactionRadiusFactor);
			if (!inZone) {
				state.armed = false;
				state.peak = 0;
				state.chunkSum = 0;
				state.chunkCount = 0;
				state.goodChunks = 0;
				state.debugArmed = false;
				state.debugPeak = 0;
				state.debugChunkSum = 0;
				state.debugChunkCount = 0;
				state.debugGoodChunks = 0;
				continue;
			}
			if (justPickedUpTool && typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
				print("[TOOL_PICKUP_CONTACT]", {
					toolItemId: toolItemId,
					targetHitboxId: hbId,
					targetItemId: zoneG.modelItemId,
					interactionMode: hb.interactionMode || "grab",
					tipSpeed: this.toolTipSpeed
				});
			}
			if (hb.requiredTool && toolItemId !== hb.requiredTool) {
				state.armed = false;
				state.peak = 0;
				state.chunkSum = 0;
				state.chunkCount = 0;
				state.goodChunks = 0;
				continue;
			}
			state.debugChunkSum += this.toolTipSpeed;
			state.debugChunkCount++;
			if (state.debugChunkCount >= chunkFrames) {
				const debugAvg = state.debugChunkSum / state.debugChunkCount;
				const debugChunkMatch = isSpeedMatch(debugAvg);
				if (debugChunkMatch) {
					state.debugGoodChunks++;
				} else {
					state.debugGoodChunks = 0;
				}
				state.debugChunkSum = 0;
				state.debugChunkCount = 0;
			}
			if (state.debugGoodChunks >= requiredChunks) {
				if (typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
					print("[TOOL_ACTION_TRIGGER_TEST]", {
						toolItemId: toolItemId,
						targetHitboxId: hbId,
						targetItemId: zoneG.modelItemId,
						interactionMode: hb.interactionMode || "grab",
						tipSpeed: this.toolTipSpeed
					});
				}
				state.debugGoodChunks = 0;
			}
			if (hb.interactionMode !== "cut_gesture") {
				continue;
			}
			state.chunkSum += this.toolTipSpeed;
			state.chunkCount++;
			if (state.chunkCount >= chunkFrames) {
				const avgSpeed = state.chunkSum / state.chunkCount;
				const chunkMatch = isSpeedMatch(avgSpeed);
				if (chunkMatch) {
					state.goodChunks++;
				} else {
					state.goodChunks = 0;
				}
				state.chunkSum = 0;
				state.chunkCount = 0;
			}
			if (state.goodChunks >= requiredChunks) {
				if (typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
					print("[TOOL_ACTION_TRIGGER]", {
						toolItemId: toolItemId,
						targetHitboxId: hbId,
						targetItemId: zoneG.modelItemId,
						tipSpeed: this.toolTipSpeed
					});
				}
				applyHitboxDeclarativeRules(zoneG);
				zoneG.hasBeenGrabbed = true;
				markModelItemInteracted(zoneG.modelItemId);
				state.goodChunks = 0;
				state.cooldown = hb.cutCooldownFrames || toolConfig.cutCooldownFrames;
			}
		}
		this.toolPreviewChunkSum += this.toolTipSpeed;
		this.toolPreviewChunkCount++;
		if (this.toolPreviewChunkCount >= chunkFrames) {
			const previewAvg = this.toolPreviewChunkSum / this.toolPreviewChunkCount;
			const previewChunkMatch = isSpeedMatch(previewAvg);
			if (previewChunkMatch) {
				this.toolPreviewGoodChunks++;
				this.toolPreviewBadChunks = 0;
			} else {
				this.toolPreviewBadChunks++;
				const offChunks = max(1, int(toolConfig.toolPreviewEndChunks || ceil(requiredChunks * 0.5)));
				if (this.toolPreviewBadChunks >= offChunks) {
					this.toolPreviewGoodChunks = 0;
					this.toolPreviewBadChunks = 0;
					this.toolPreviewActive = false;
				}
			}
			this.toolPreviewChunkSum = 0;
			this.toolPreviewChunkCount = 0;
		}
		const previewStartChunks = max(1, int(toolConfig.toolPreviewStartChunks || 1));
		if (this.toolPreviewGoodChunks >= previewStartChunks) {
			this.toolPreviewActive = true;
		}
	}
	checkzig() {
		if (zigProgress == zig.length){
			print("ZIGGED");
			zigProgress = 0;
			return
		}
		if (vdist(this.indexTip,zstart)<100){
			zigProgress = 1;
			print("reset")
			// circle(this.indexTip.x,this.indexTip.y,70)
			return
		}
		else {
			let next = zig[zigProgress]
			// print(zigProgress)
			if (vdist(this.indexTip,vadd(next,zstart))<100){
				// circle(this.indexTip.x,this.indexTip.y,50)
				zigProgress ++;
			}
		}
		
	}
	
	// pinch(p){
	// 	this.pinchPt = mid(indexTip,thumbTip)
	// }	
}

class grabbable {
	constructor(x,y,s,v, ID, pic) {
		this.pt = createVector(x,y)
		this.s = s
		this.grabbed = false
		this.color = color(s*2,s*2,255)
		this.visible = v;
		this.isGrabbed = false;
		this.hasEverBeenPickedUp = false;
		this.hasBeenGrabbed = false;
		this.itemID = ID;
		this.pic = pic;
		this.origX = x;
		this.origY = y;
		this.movable = true;
		this.active = true;
		this.grabbedByHandSide = "right";
		this.baseScale = 1;
		this.currentScale = 1;
		this.grabScale = 1.1;
		this.currentRotation = 0;
		this.grabRotation = random(-10, 10);
		this.dropSpinVelocity = 0;
		this.wasGrabbedLastFrame = false;
		this.pendingDrawerDock = false;
		this.returningToDrawer = false;
		this.returnDrawerIdx = -1;
		this.binConsumeActive = false;
		this.binConsumeFrame = 0;
		this.binConsumeStartPt = null;
		this.binConsumeTargetPt = null;
		this.binConsumeStartScale = 1;
		this.binConsumeStartRot = 0;
		this.bounceFramesLeft = 0;
		this.bounceSpinPerFrame = 0;
		this.pendingDropSpin = 0;
		this.pickupOrder = -1;
		this.minPinchGeneration = 0;
		this.isThrown = false;
		this.throwVelocity = createVector(0, 0); // Linear trajectory only (position).
		this.throwAngularVelocity = 0;
		this.throwStartSpeed = 0;
		this.throwStartScale = 1;
		this.throwPeakScale = 1.35;
		this.endBounceVelocity = createVector(0, 0);
		this.endBounceAngularVelocity = 0;
	}
	startThrow(v) {
		this.isThrown = true;
		this.throwVelocity = v.copy(); // Position trajectory source.
		this.throwStartSpeed = max(0.001, this.throwVelocity.mag());
		this.throwStartScale = this.currentScale;
		this.throwPeakScale = max(this.throwStartScale, 2);
		const spinSign = (abs(this.throwVelocity.x) >= abs(this.throwVelocity.y))
			? (this.throwVelocity.x >= 0 ? 1 : -1)
			: (this.throwVelocity.y >= 0 ? 1 : -1);
		this.throwAngularVelocity = spinSign * constrain(this.throwStartSpeed * 0.35, 16, 40);
		this.dropSpinVelocity = 0;
		this.pendingDropSpin = 0;
		this.bounceFramesLeft = 0;
		this.endBounceVelocity.set(0, 0);
		this.endBounceAngularVelocity = 0;
	}
	updateThrowMotion() {
		if (!this.isThrown) {
			return;
		}
		// Position trajectory is strictly linear-velocity based.
		this.pt.x += this.throwVelocity.x;
		this.pt.y += this.throwVelocity.y;
		if (this.pt.x < 0) {
			this.pt.x = 0;
			this.throwVelocity.x = 0;
		}
		if (this.pt.x > w) {
			this.pt.x = w;
			this.throwVelocity.x = 0;
		}
		if (this.pt.y < 0) {
			this.pt.y = 0;
			this.throwVelocity.y = 0;
		}
		if (this.pt.y > h) {
			this.pt.y = h;
			this.throwVelocity.y = 0;
		}
		// Rotation is strictly angular-velocity based and does not feed back into position.
		this.currentRotation += this.throwAngularVelocity;
		this.throwVelocity.mult(THROW_DECEL);
		this.throwAngularVelocity *= THROW_SPIN_DAMP;
		const speedNow = this.throwVelocity.mag();
		const throwProgress = 1 - constrain(speedNow / this.throwStartSpeed, 0, 1);
		let targetThrowScale;
		if (throwProgress < 0.5) {
			targetThrowScale = lerp(this.throwStartScale, this.throwPeakScale, throwProgress * 2);
		} else {
			targetThrowScale = lerp(this.throwPeakScale, this.baseScale, (throwProgress - 0.5) * 2);
		}
		this.currentScale = lerp(this.currentScale, targetThrowScale, 0.32);
		if (this.throwVelocity.mag() < 0.25 && abs(this.throwAngularVelocity) < 0.2) {
			const endDir = this.throwVelocity.mag() > 0.0001
				? this.throwVelocity.copy().normalize()
				: createVector(0, 0);
			this.endBounceVelocity = p5.Vector.mult(endDir, -2.2);
			this.endBounceAngularVelocity = -Math.sign(this.throwAngularVelocity || 1) * 2.5;
			this.isThrown = false;
			this.throwVelocity.set(0, 0);
			this.throwAngularVelocity = 0;
		}
	}
	
	drop(){
		this.updateThrowMotion();
		if (this.endBounceVelocity.mag() > 0.01 || abs(this.endBounceAngularVelocity) > 0.01) {
			this.pt.add(this.endBounceVelocity);
			this.pt.x = constrain(this.pt.x, 0, w);
			this.pt.y = constrain(this.pt.y, 0, h);
			this.currentRotation += this.endBounceAngularVelocity;
			this.endBounceVelocity.mult(0.55);
			this.endBounceAngularVelocity *= 0.55;
		}
	}
ud(pt, handSide) {
		if (!this.active) {
			return;
		}
		if (!this.isGrabbed) {
			if (isToolItem(this.itemID)) {
				// Tools settle to handed hold orientation.
				const handObj = getHandBySide(handSide || this.grabbedByHandSide);
				const previewT = handObj ? handObj.toolPreviewT : 0;
				this.grabRotation = getToolAngleForSide(handSide) + getToolPreviewAngleOffsetForSide(handSide, previewT);
			} else {
				this.grabRotation = this.currentRotation + random(-10, 10);
			}
			this.pickupOrder = ++grabRenderCounter;
		}
		if (isToolItem(this.itemID)) {
			const handObj = getHandBySide(handSide || this.grabbedByHandSide);
			const previewT = handObj ? handObj.toolPreviewT : 0;
			this.grabRotation = getToolAngleForSide(handSide) + getToolPreviewAngleOffsetForSide(handSide, previewT);
			this.grabScale = lerp(1.1, toolConfig.toolPreviewToolScale, previewT);
		}
		this.isGrabbed = true;
		this.pendingDrawerDock = false;
		this.returningToDrawer = false;
		this.returnDrawerIdx = -1;
		if (isToolItem(this.itemID)) {
			this.hasEverBeenPickedUp = true;
		}
		if (handSide) {
			this.grabbedByHandSide = handSide;
		}
		this.isThrown = false;
		this.throwVelocity.set(0, 0);
		this.throwAngularVelocity = 0;
		if (this.movable)
		{
			this.pt.x = constrain(pt.x, 0, w);
			this.pt.y = constrain(pt.y, 0, h);
		}
		this.visible=true;
		
		if (!this.hasBeenGrabbed)
			{
				let rand = random(4);
				if (rand>3)
					{
						rustle.play()
					}
				else if (rand>2) {
					rustleL.play()
				}
				else if (rand>1){
					pickup.play();
				}
				else {
					pickupL.play();
				}
				// print("update")
				this.hasBeenGrabbed = true;
				if (handleBody1ItemFirstGrab(this)) {
					return;
				}
				if (handleBody2ItemFirstGrab(this)) {
					return;
				}
				if (handleBody3ItemFirstGrab(this)) {
					return;
				}
				switch (this.modelItemId){
					case "tool_scalpel":
					scalpelInUse = true;
						this.hasBeenGrabbed=false;
						break;
					case "tool_bonesaw":
					bonesawInUse = true;
						this.hasBeenGrabbed=false;
						break;
						
					case "tool_hammer":
					hammerInUse = true;
						this.hasBeenGrabbed=false;
						break;
				}
				
					
			}
	}
	
	display() {
		if (this.binConsumeActive) {
			if (this.visible && (this.pic != null)) {
				push();
				translate(this.pt.x, this.pt.y);
				push();
				rotate(this.currentRotation);
				scale(this.currentScale);
				if (isToolItem(this.itemID) && this.grabbedByHandSide === "left") {
					scale(-1, 1);
				}
				image(this.pic, 0, 0);
				pop();
				pop();
			}
			this.wasGrabbedLastFrame = this.isGrabbed;
			return;
		}
		if (!this.isThrown && !this.wasGrabbedLastFrame && this.isGrabbed) {
			// Pickup bounce: tiny opposite pre-rotation before settling toward grabRotation.
			const dir = this.grabRotation === 0 ? 1 : Math.sign(this.grabRotation);
			this.bounceFramesLeft = 2;
			this.bounceSpinPerFrame = -dir * 1.2;
		}
		if (!this.isThrown && this.wasGrabbedLastFrame && !this.isGrabbed) {
			// Drop bounce: brief opposite rotation, then release spin.
			this.pendingDropSpin = random(-4, 4);
			const dir = this.pendingDropSpin === 0 ? 1 : Math.sign(this.pendingDropSpin);
			this.bounceFramesLeft = 2;
			this.bounceSpinPerFrame = -dir * 1.4;
		}
		this.wasGrabbedLastFrame = this.isGrabbed;

		const targetScale = this.isGrabbed ? this.grabScale : this.baseScale;
		const targetRot = this.isGrabbed ? this.grabRotation : this.currentRotation;
		this.currentScale = lerp(this.currentScale, targetScale, 0.29);
		this.currentRotation = lerp(this.currentRotation, targetRot, 0.24);
		if (this.bounceFramesLeft > 0) {
			this.currentRotation += this.bounceSpinPerFrame;
			this.bounceFramesLeft--;
			if (this.bounceFramesLeft === 0 && this.pendingDropSpin !== 0) {
				this.dropSpinVelocity = this.pendingDropSpin;
				this.pendingDropSpin = 0;
			}
		}
		this.currentRotation += this.dropSpinVelocity;
		this.dropSpinVelocity *= 0.8;

		noStroke();
		fill(255, 255, 255, 50);
		//circle(this.pt.x,this.pt.y, this.s);
		
		if(this.visible && (this.pic != null))
			{
				// Position transform scope (trajectory only).
				push();
				translate(this.pt.x, this.pt.y);
				// Rotation/scale transform scope (visual only).
				push();
				rotate(this.currentRotation);
				scale(this.currentScale);
				if (isToolItem(this.itemID) && this.grabbedByHandSide === "left") {
					scale(-1, 1);
				}
				image(this.pic, 0, 0);
				pop();
				pop();
				//image(this.pic, wc, hc);
			}
	}
}


function toss(g)
{
	g.pt.x = GONE;
	g.pt.y = GONE;
	g.visible = false;
}

function untoss(g)
{
	g.pt.x = g.origX;
	g.pt.y = g.origY;
	//g.visible = true;
}

function applyUiInteractionConfig() {
	if (!uiInteractionsData) return;
	const cfg = uiInteractionsData;
	uiConfig = {
		...uiConfig,
		...cfg,
		panel: { ...uiConfig.panel, ...(cfg.panel || {}) },
		drawer: { ...uiConfig.drawer, ...(cfg.drawer || {}) },
		bins: { ...uiConfig.bins, ...(cfg.bins || {}) }
	};
	if (cfg.drawer && Array.isArray(cfg.drawer.hitboxes)) {
		uiConfig.drawer.hitboxes = cfg.drawer.hitboxes;
	}
	if (cfg.bins && cfg.bins.top) {
		uiConfig.bins.top = cfg.bins.top;
	}
	if (cfg.bins && cfg.bins.bottom) {
		uiConfig.bins.bottom = cfg.bins.bottom;
	}
	if (!Array.isArray(uiConfig.uiHitboxes)) {
		uiConfig.uiHitboxes = [];
	}
}

function applyToolConfig() {
	if (!toolConfigData) return;
	toolConfig = {
		...toolConfig,
		...toolConfigData,
		tools: toolConfigData.tools || toolConfig.tools || { items: [] }
	};
}

function preloadWeg() {
  // Load the handpose model.
	zig = [createVector(0,0),createVector(200,0),createVector(400,0),createVector(500,0),createVector(400,100),createVector(200,400),createVector(0,500),createVector(500,500)];
	zstart = createVector(w/5,h/5);
  handpose = ml5.handpose(options);
	bodyGrabbablesData = loadJSON("data/body-grabbables.json");
	uiInteractionsData = loadJSON("data/ui-interactions.json");
	toolConfigData = loadJSON("data/tool-config.json");
}

//SETUP

function setupWeg() {
	
	colorMode(RGB,255)
	if (!mainCanvas) {
		mainCanvas = createCanvas(w, h);
	}
	resizeCanvas(w, h);
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  // start detecting hands from the webcam video
	handpose.detectStart(video, gotHands);
	applyUiInteractionConfig();
	applyToolConfig();
	// for (let i=0; i<10; i++){
	// 	grabbables.push(new grabbable(width/2, i*height/10,30+(5*i)))
	// }
	handTracker = (new tracker());
	resetInteractionModel();
	
	setupBody1();
	setupTools();
	
}

function drawWeg() {
	
  // Draw the webcam video
	//background(255);
	push();
	if (options.flipHorizontal){
		translate(width,0); 
		scale(-1,1);
	}
	let transparency = 100; // reduce this to make video transparent
	tint(255,255,255,transparency); 
  //image(video, 0, 0, width, height);
	pop();

	updateUiJitterOffsets();
	handTracker.ud();
	updateDragPanelInteraction();
	updateDrawerGrabInteractions();
	updateBinGrabInteractions();
	for (let i=0; i<grabbables.length; i++){
		grabbables[i].drop();
		maybeDockToolIntoDrawer(grabbables[i]);
	}
	updateBinIntake();
	renderGrabbablesUnderClaws();
	drawHands();
	renderGrabbablesOverClaws();
	drawPanelClipDifferenceOverlay();
	// updateHand();
	// handTracker.display();
	stroke(255,0,0)
	strokeWeight(10)
	// line(10,10,s,10)
	noFill();
	if (zigmode){
		circle(zstart.x,zstart.y,100);
		for (let i=0; i<zig.length-1; i++){
			line(zig[i].x+zstart.x,zig[i].y+zstart.y,zig[i+1].x+zstart.x,zig[i+1].y+zstart.y);
		}
	}
}

function drawDebugInteractableHitboxes() {
	if (typeof DEBUG_MODE === "undefined" || !DEBUG_MODE) {
		return;
	}
	const isOnScreen = (pt) => pt && pt.x >= 0 && pt.x <= w && pt.y >= 0 && pt.y <= h;
	const toolHotSet = new Set();
	for (let hIdx = 0; hIdx < handTracker.hands.length; hIdx++) {
		const handObj = handTracker.hands[hIdx];
		if (!handObj || !handObj.grabbed || !isToolItem(handObj.grabbed.itemID) || !handObj.debugToolTip) {
			continue;
		}
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g || !isOnScreen(g.pt)) {
				continue;
			}
			const interactionRadius = g.s * toolConfig.interactionRadiusFactor;
			if (vdist(handObj.debugToolTip, g.pt) <= interactionRadius) {
				toolHotSet.add(i);
			}
		}
	}

	push();
	noFill();
	strokeWeight(2);

	// Grabbable hitboxes (all visible interactables on screen).
	for (let i = 0; i < grabbables.length; i++) {
		const g = grabbables[i];
		if (!g || !isOnScreen(g.pt)) {
			continue;
		}
		const toolInside = toolHotSet.has(i);
		const baseColor = g.hasBeenGrabbed ? color(0, 120, 255, 210) : color(255, 60, 60, 210);
		stroke(toolInside ? color(0, 255, 120, 230) : baseColor);
		circle(g.pt.x, g.pt.y, g.s * 2);
		stroke(toolInside ? color(255, 255, 0, 230) : color(255, 255, 255, 90));
		circle(g.pt.x, g.pt.y, g.s * toolConfig.interactionRadiusFactor * 2);
	}

	// Drop-zone interactables.
	stroke(255, 220, 0, 190);
	rectMode(CORNERS);
	rect(uiConfig.bins.top.x1, uiConfig.bins.top.y1, uiConfig.bins.top.x2, uiConfig.bins.top.y2);
	rect(uiConfig.bins.bottom.x1, uiConfig.bins.bottom.y1, uiConfig.bins.bottom.x2, uiConfig.bins.bottom.y2);

	// Per-hand grab interaction radii (matches grab logic).
	for (let hIdx = 0; hIdx < handTracker.hands.length; hIdx++) {
		const handObj = handTracker.hands[hIdx];
		const p = handObj.pinchPt;
		const baseR = (handObj.grabReach / getWindowScaleFactor());
		let anyInRange = false;
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g || !isOnScreen(g.pt) || !g.active) {
				continue;
			}
			const edgeToEdgeReach = baseR + (g.s / getWindowScaleFactor());
			if (vdist(p, g.pt) <= edgeToEdgeReach) {
				anyInRange = true;
				break;
			}
		}
		stroke(anyInRange ? color(0, 255, 120, 220) : color(255, 255, 255, 120));
		circle(p.x, p.y, baseR * 2);
	}
	pop();
}

function drawGrabbableVisualSnapshot(g) {
	if (!g || !g.visible || !g.pic) return;
	push();
	imageMode(CENTER);
	translate(g.pt.x, g.pt.y);
	push();
	rotate(g.currentRotation);
	scale(g.currentScale);
	if (isToolItem(g.itemID) && g.grabbedByHandSide === "left") {
		scale(-1, 1);
	}
	image(g.pic, 0, 0);
	pop();
	pop();
}

function drawPanelClipDifferenceOverlay() {
	const clipCfg = uiConfig.panelClip || {};
	const hasRawCorners =
		typeof clipCfg.x1 === "number" &&
		typeof clipCfg.y1 === "number" &&
		typeof clipCfg.x2 === "number" &&
		typeof clipCfg.y2 === "number";
	const insetX = (typeof clipCfg.insetX === "number") ? clipCfg.insetX : 50;
	const extendY = (typeof clipCfg.extendY === "number") ? clipCfg.extendY : 50;
	const x1 = hasRawCorners ? clipCfg.x1 : (uiConfig.panel.x1 + insetX);
	const x2 = hasRawCorners ? clipCfg.x2 : (uiConfig.panel.x2 - insetX);
	const y1Base = hasRawCorners ? clipCfg.y1 : (uiConfig.panel.y1 - extendY);
	const y2Base = hasRawCorners ? clipCfg.y2 : (uiConfig.panel.y2 + extendY);
	const y1 = y1Base + dragPanel.offsetY;
	const y2 = y2Base + dragPanel.offsetY;
	if (x2 <= x1 || y2 <= y1) return;

	push();
	drawingContext.save();
	drawingContext.beginPath();
	drawingContext.rect(x1, y1, x2 - x1, y2 - y1);
	drawingContext.clip();

	noStroke();
	fill(255);
	rectMode(CORNERS);
	rect(x1, y1, x2, y2);

	blendMode(BLEND);
	imageMode(CENTER);
	if (typeof background_xray !== "undefined" && background_xray) {
		image(background_xray, wc, hc);
	}
	if (typeof bedTrackBody !== "undefined") {
		if (bedTrackBody === 1 && typeof body1_xray !== "undefined" && body1_xray) {
			image(body1_xray, bedTrackX, bedTrackY);
		} else if (bedTrackBody === 2 && typeof body2_xray !== "undefined" && body2_xray) {
			image(body2_xray, bedTrackX, bedTrackY);
		}
	}

	blendMode(DIFFERENCE);
	drawBodyGrabbablePartsDifference();
	for (let i = 0; i < grabbables.length; i++) {
		drawGrabbableVisualSnapshot(grabbables[i]);
	}
	blendMode(BLEND);

	drawingContext.restore();
	pop();
}

function drawBodyGrabbablePartsDifference() {
	if (typeof bedTrackBody === "undefined") return;
	const x = bedTrackX;
	const y = bedTrackY;
	imageMode(CENTER);
	if (bedTrackBody === 1) {
		const hasArm = !hasModelItemBeenInteracted("b1_arm");
		const hasLeg = !hasModelItemBeenInteracted("b1_leg");
		const hasEyeball = !hasModelHitboxBeenGrabbed("b1_eye_ball");
		if (hasArm && typeof body1arm !== "undefined" && body1arm) image(body1arm, x, y);
		if (hasLeg && typeof body1leg !== "undefined" && body1leg) image(body1leg, x, y);
		if (hasEyeball && typeof body1eyeball !== "undefined" && body1eyeball) image(body1eyeball, x, y);
		return;
	}
	if (bedTrackBody === 2) {
		const hasKnee = !hasModelItemBeenInteracted("b2_knee");
		const hasHand = !hasModelItemBeenInteracted("b2_hand");
		const hasHeart = !hasModelItemBeenInteracted("b2_heart");
		const hasRibs = !hasModelItemBeenInteracted("b2_rib");
		if (hasKnee && typeof body2knee !== "undefined" && body2knee) image(body2knee, x, y);
		if (hasHand && typeof body2hand !== "undefined" && body2hand) image(body2hand, x, y);
		if (hasRibs && typeof body2ribs !== "undefined" && body2ribs) image(body2ribs, x, y);
		if (hasHeart && typeof body2heart !== "undefined" && body2heart) image(body2heart, x, y);
		return;
	}
	if (bedTrackBody === 3) {
		const hasFoot = !hasModelItemBeenInteracted("b3_foot");
		const hasSkull = !hasModelItemBeenInteracted("b3_skull");
		const hasGuts = !hasModelItemBeenInteracted("b3_guts");
		const hasSkin = !hasModelItemBeenInteracted("b3_skin");
		const hasBrain = !hasModelItemBeenInteracted("b3_brain");
		if (hasFoot && typeof body3foot !== "undefined" && body3foot) image(body3foot, x, y);
		if (hasGuts && (!hasSkin) && typeof body3guts !== "undefined" && body3guts) image(body3guts, x, y);
		if (hasBrain && (!hasSkull) && typeof body3brain !== "undefined" && body3brain) image(body3brain, x, y);
	}
}

function renderGrabbablesUnderClaws() {
	const released = [];
	for (let i = 0; i < grabbables.length; i++) {
		if (!grabbables[i].isGrabbed) {
			released.push(grabbables[i]);
		}
	}
	released.sort((a, b) => a.pickupOrder - b.pickupOrder);
	for (let i = 0; i < released.length; i++) {
		released[i].display();
	}
}

function renderGrabbablesOverClaws() {
	const held = [];
	for (let i = 0; i < grabbables.length; i++) {
		if (grabbables[i].isGrabbed) {
			held.push(grabbables[i]);
		}
	}
	held.sort((a, b) => a.pickupOrder - b.pickupOrder);
	for (let i = 0; i < held.length; i++) {
		held[i].display();
	}
}

function drawHands(){
	for (let i=0; i<handTracker.hands.length; i++){
		let h = handTracker.hands[i]
		let p = h.getRenderPinchPt();
		const clawImg = h.pinching ? closedclaw : openclaw;
		if (!clawImg) {
			continue;
		}
		if (h.handSide === "left") {
			push();
			translate(p.x, p.y);
			scale(-1, 1);
			imageMode(CENTER);
			scale(h.clawScale, h.clawScale);
			image(clawImg, 0, 0);
			pop();
		} else {
			push();
			translate(p.x, p.y);
			imageMode(CENTER);
			scale(h.clawScale, h.clawScale);
			image(clawImg, 0, 0);
			pop();
		}

	}
	
}

function drawHandDebugOverlay() {
	if (typeof DEBUG_MODE === "undefined" || !DEBUG_MODE) {
		return;
	}
	for (let i = 0; i < handTracker.hands.length; i++) {
		const h = handTracker.hands[i];
		const p = h.pinchPt;
		push();
		noFill();
		stroke(255, 0, 255, 230);
		strokeWeight(2);
		circle(p.x, p.y, 14);
		pop();

		if (h.grabbed && isToolItem(h.grabbed.itemID)) {
			const explicitTip = getHeldToolTipPoint(h.grabbed, h.handSide);
			if (explicitTip) {
				push();
				stroke(255, 180, 0);
				strokeWeight(2);
				line(p.x, p.y, explicitTip.x, explicitTip.y);
				noFill();
				circle(p.x, p.y, 14);
				circle(explicitTip.x, explicitTip.y, 14);
				pop();
			}
		}

		if (h.debugToolTip) {
			const heldTool = h.grabbed;
			const toolLen = heldTool ? heldTool.s : 0;
			push();
			stroke(255, 180, 0);
			strokeWeight(2);
			line(p.x, p.y, h.debugToolTip.x, h.debugToolTip.y);
			noFill();
			circle(p.x, p.y, 14);
			circle(h.debugToolTip.x, h.debugToolTip.y, 14);
			circle(p.x, p.y, toolLen * 2);
			pop();

			for (let j = 0; j < h.debugToolHits.length; j++) {
				const g = h.debugToolHits[j];
				push();
				noFill();
				stroke(0, 255, 0);
				strokeWeight(3);
				circle(g.pt.x, g.pt.y, g.s * toolConfig.interactionRadiusFactor * 2);
				pop();
			}
		}
	}
}

function drawAllDebugOverlays() {
	if (typeof DEBUG_MODE === "undefined" || !DEBUG_MODE) {
		return;
	}
	drawPanelDebugOverlay();
	drawDebugInteractableHitboxes();
	drawHandDebugOverlay();
}

function drawPanelDebugOverlay() {
	const y1 = uiConfig.panel.y1 + dragPanel.offsetY;
	const y2 = uiConfig.panel.y2 + dragPanel.offsetY;
	push();
	noFill();
	stroke(80, 220, 255, 220);
	strokeWeight(3);
	rectMode(CORNERS);
	rect(uiConfig.panel.x1, y1, uiConfig.panel.x2, y2);
	stroke(255, 180, 0, 220);
	line(uiConfig.panel.x1, uiConfig.panel.lockY + dragPanel.offsetY, uiConfig.panel.x2, uiConfig.panel.lockY + dragPanel.offsetY);
	stroke(80, 180, 255, 160);
	rect(uiConfig.drawer.hitboxes[0].x1, uiConfig.drawer.hitboxes[0].y1, uiConfig.drawer.hitboxes[0].x2, uiConfig.drawer.hitboxes[0].y2);
	rect(uiConfig.drawer.hitboxes[1].x1, uiConfig.drawer.hitboxes[1].y1, uiConfig.drawer.hitboxes[1].x2, uiConfig.drawer.hitboxes[1].y2);
	rect(uiConfig.drawer.hitboxes[2].x1, uiConfig.drawer.hitboxes[2].y1, uiConfig.drawer.hitboxes[2].x2, uiConfig.drawer.hitboxes[2].y2);
	stroke(80, 180, 255, 120);
	line(uiConfig.drawer.hitboxes[0].x1, uiConfig.drawer.hitboxes[0].lockY, uiConfig.drawer.hitboxes[0].x2, uiConfig.drawer.hitboxes[0].lockY);
	line(uiConfig.drawer.hitboxes[1].x1, uiConfig.drawer.hitboxes[1].lockY, uiConfig.drawer.hitboxes[1].x2, uiConfig.drawer.hitboxes[1].lockY);
	line(uiConfig.drawer.hitboxes[2].x1, uiConfig.drawer.hitboxes[2].lockY, uiConfig.drawer.hitboxes[2].x2, uiConfig.drawer.hitboxes[2].lockY);
	stroke(255, 140, 40, 180);
	strokeWeight(2);
	for (let i = 0; i < uiConfig.uiHitboxes.length; i++) {
		const hb = uiConfig.uiHitboxes[i];
		rect(hb.x1, hb.y1, hb.x2, hb.y2);
	}
	stroke(255, 90, 90, 200);
	if (!isBinOpen(0)) {
		rect(uiConfig.bins.lockZoneX1, uiConfig.bins.top.y1, uiConfig.bins.lockZoneX2, uiConfig.bins.top.y2);
	}
	if (!isBinOpen(1)) {
		rect(uiConfig.bins.lockZoneX1, uiConfig.bins.bottom.y1, uiConfig.bins.lockZoneX2, uiConfig.bins.bottom.y2);
	}
	stroke(255, 200, 120, 190);
	if (!isBinOpen(0)) {
		line(uiConfig.bins.lockX, uiConfig.bins.top.y1, uiConfig.bins.lockX, uiConfig.bins.top.y2);
	}
	if (!isBinOpen(1)) {
		line(uiConfig.bins.lockX, uiConfig.bins.bottom.y1, uiConfig.bins.lockX, uiConfig.bins.bottom.y2);
	}
	pop();
}



// Callback function for when handpose outputs data
function gotHands(results) {
  // save the output to the hands variable
  hands = results;

	handTracker.beginFrame();
	for (let i = 0; i < hands.length; i++) {
		handTracker.upsertHand(hands[i]);
	}
	handTracker.endFrame();
}

function getPicByKeyMap() {
	return {
		body1flap, body1arm_severed, body1leg_severed, body1eyeball_severed,
		scalpel, bonesaw, hammer,
		body2_hand_severed, body2_knee_severed, body2_heart_severed, body2flap,
		body3_guts_severed, body3_brain_severed, body3_foot_severed, body3flap
	};
}

function getItemDefsForSection(bodyKey) {
	if (bodyKey === "tools") {
		const toolItems = toolConfigData?.tools?.items;
		return Array.isArray(toolItems) ? toolItems : [];
	}
	if (!bodyGrabbablesData || !bodyGrabbablesData[bodyKey]) {
		return [];
	}
	const section = bodyGrabbablesData[bodyKey];
	return Array.isArray(section?.items) ? section.items : [];
}

function setupGrabbablesFromBodyDefs(bodyKey) {
	const picByKey = getPicByKeyMap();
	const items = getItemDefsForSection(bodyKey);
	if (!items.length) {
		return;
	}
	for (let i = 0; i < items.length; i++) {
		const itemDef = items[i];
		const hitboxes = Array.isArray(itemDef.hitboxes) ? itemDef.hitboxes : [];
		for (let j = 0; j < hitboxes.length; j++) {
			const hb = hitboxes[j];
			const id = itemDef.itemId || hb.itemId || hb.hitboxId || hb.idName;
			const isTool = isToolItem(id);
			const picKey = hb.picKey || itemDef.picKey;
			const pic = picKey ? picByKey[picKey] : null;
			const g = new grabbable(hb.x, hb.y, hb.radius, false, id, pic);
			const active = (typeof hb.active === "boolean") ? hb.active : (typeof itemDef.active === "boolean" ? itemDef.active : true);
			g.active = active;
			if (hb.movable === false || itemDef.movable === false) {
				g.movable = false;
			}
			if (isTool) {
				g.currentRotation = toolConfig.rightToolAngle;
				g.grabRotation = toolConfig.rightToolAngle;
			}
			grabbables.push(g);
			const grabbableIndex = grabbables.length - 1;
			registerModelHitbox(bodyKey, itemDef, hb, id, g, grabbableIndex);
			if (hb.toss || itemDef.toss) {
				toss(g);
			}
		}
	}
}

function setupBody1() { setupGrabbablesFromBodyDefs("body1"); }
function setupTools() { setupGrabbablesFromBodyDefs("tools"); }
function setupBody2() { setupGrabbablesFromBodyDefs("body2"); }
function setupBody3() { setupGrabbablesFromBodyDefs("body3"); }

function setBodyGrabbablesActive(bodyNum, isActive) {
	const bodyKey = bodyNum === 1 ? "body1" : (bodyNum === 2 ? "body2" : (bodyNum === 3 ? "body3" : null));
	if (!bodyKey || !interactionModel || !interactionModel.bodyHitboxIds.has(bodyKey)) {
		return;
	}
	const hitboxIds = interactionModel.bodyHitboxIds.get(bodyKey);
	for (let i = 0; i < hitboxIds.length; i++) {
		const hb = interactionModel.hitboxesById.get(hitboxIds[i]);
		if (!hb) {
			continue;
		}
		const g = grabbables[hb.grabbableIndex];
		if (g) {
			if (g.isConsumed) {
				g.active = false;
				continue;
			}
			if (!isActive && g.hasBeenGrabbed) {
				g.active = true;
			} else {
				g.active = isActive;
			}
		}
	}
}

function cleanupBodyUninteracted(bodyKey) {
	if (!interactionModel || !interactionModel.bodyItemIds.has(bodyKey)) {
		return;
	}
	const itemIds = interactionModel.bodyItemIds.get(bodyKey);
	for (let i = 0; i < itemIds.length; i++) {
		const itemId = itemIds[i];
		const hitboxes = getModelHitboxesForItem(itemId);
		let anyGrabbed = false;
		for (let j = 0; j < hitboxes.length; j++) {
			const g = grabbables[hitboxes[j].grabbableIndex];
			if (g && g.hasBeenGrabbed) {
				anyGrabbed = true;
				break;
			}
		}
		if (anyGrabbed) {
			continue;
		}
		for (let j = 0; j < hitboxes.length; j++) {
			const g = grabbables[hitboxes[j].grabbableIndex];
			if (g) {
				toss(g);
			}
		}
	}
}

function resetToolsToDrawer() {
	const toolItemIds = ["tool_scalpel", "tool_bonesaw", "tool_hammer"];
	for (let i = 0; i < toolItemIds.length; i++) {
		const g = getToolGrabbable(toolItemIds[i]);
		if (!g) {
			continue;
		}
		g.isGrabbed = false;
		g.active = false;
		g.visible = false;
		g.isConsumed = false;
		toss(g);
	}
	scalpelInUse = false;
	bonesawInUse = false;
	hammerInUse = false;
	if (handTracker && Array.isArray(handTracker.hands)) {
		for (let i = 0; i < handTracker.hands.length; i++) {
			const h = handTracker.hands[i];
			if (h && h.grabbed && isToolItem(h.grabbed.itemID)) {
				h.releaseGrab(false, false, false);
			}
		}
	}
}

function hasModelHitboxBeenGrabbed(hitboxId) {
	if (!interactionModel || !interactionModel.hitboxesById.has(hitboxId)) {
		return false;
	}
	const hb = interactionModel.hitboxesById.get(hitboxId);
	const g = grabbables[hb.grabbableIndex];
	return !!(g && g.hasBeenGrabbed);
}

function hasModelItemBeenInteracted(itemId) {
	if (interactionModel && interactionModel.itemsById.has(itemId)) {
		const item = interactionModel.itemsById.get(itemId);
		return !!(item && item.flags && item.flags.hasBeenInteracted);
	}
	const hitboxes = getModelHitboxesForItem(itemId);
	for (let i = 0; i < hitboxes.length; i++) {
		const g = grabbables[hitboxes[i].grabbableIndex];
		if (g && g.hasBeenGrabbed) {
			return true;
		}
	}
	return false;
}


const GONE = 9000;

// The following index labels may be helpful:
const ML5HAND_WRIST = 0; 
const ML5HAND_THUMB_CMC = 1; 
const ML5HAND_THUMB_MCP = 2; 
const ML5HAND_THUMB_IP = 3; 
const ML5HAND_THUMB_TIP = 4; 
const ML5HAND_INDEX_FINGER_MCP = 5; 
const ML5HAND_INDEX_FINGER_PIP = 6; 
const ML5HAND_INDEX_FINGER_DIP = 7; 
const ML5HAND_INDEX_FINGER_TIP = 8; 
const ML5HAND_MIDDLE_FINGER_MCP = 9; 
const ML5HAND_MIDDLE_FINGER_PIP = 10; 
const ML5HAND_MIDDLE_FINGER_DIP = 11; 
const ML5HAND_MIDDLE_FINGER_TIP = 12; 
const ML5HAND_RING_FINGER_MCP = 13; 
const ML5HAND_RING_FINGER_PIP = 14; 
const ML5HAND_RING_FINGER_DIP = 15; 
const ML5HAND_RING_FINGER_TIP = 16; 
const ML5HAND_PINKY_MCP = 17; 
const ML5HAND_PINKY_PIP = 18; 
const ML5HAND_PINKY_DIP = 19; 
const ML5HAND_PINKY_TIP = 20; 

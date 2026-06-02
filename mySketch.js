noslidein = false;
let mainCanvas;
const BASE_W = 1620;
const BASE_H = 1080;
let bedTrackX = 0;
let bedTrackY = 0;
let bedTrackBody = 1;
let frameNowMs = 0;
const DEBUG_MODE = false; // Toggle debug controls here.
const LOW_QUALITY_MODE_DEFAULT = false; // Initial quality mode at boot.
let lowQualityMode = LOW_QUALITY_MODE_DEFAULT;
let debugTimerPaused = false;
let debugPausedRemainingMs = 0;
const BODY_ENTER_SPEED = 9;
const CHECK_LABEL_MS = 500;
const CHECK_INCINERATE_MS = 500;
const CHECK_RESULT_MS = 750;
const CHECK_START_DELAY_MS = 1000;
const CHECK_INCOMING_MS = 600;
const CHECK_HOLD_MS = 180;
const CHECK_ARRIVAL_JITTER_MS = 180;
const CHECK_ARRIVAL_JITTER_MAG = 8;
const BODY_EXIT_INCINERATE_MS = 3000;
const CHECK_FINAL_SCORE_HOLD_MS = 1000;
const CHECK_PANEL_SHOW_MS = 700;
const RESTART_TRANSITION_MS = 900;
const RESTART_TIMER_DELAY_MS = 180;
const START_SCREEN_TIMER_IN_MS = 700;
const START_SCREEN_PANEL_IN_MS = 700;
let checkPhaseActive = false;
let checkPhaseDone = false;
let checkPhasePending = false;
let checkPhaseStartAtMs = 0;
let checkPhasePanelHideActive = false;
let checkPhasePanelHideStartMs = 0;
let checkPhasePanelHideFromOffsetY = 0;
let checkEvents = [];
let checkIndex = 0;
let checkStage = "incoming"; // "incoming" | "hold" | "incinerate" | "result" | "final_score" | "final_prompt"
let checkStageStartMs = 0;
let checkFinalText = "";
let checkIncomingFrames = 0;
let checkOutgoingFrames = 0;
let forceAdvanceQueued = false;
let restartTransitionActive = false;
let restartTransitionStartMs = 0;
let restartTransitionTimerFromY = 0;
let restartTransitionBodyFromY = 0;
let restartTransitionPanelFromOffsetY = 0;
let restartTransitionAnimateBody = false;
let restartTransitionDelayTimer = false;
let startScreenActive = true;
let startScreenStartMs = 0;
let timerIntroActive = true;
let timerIntroStartMs = 0;

function setQualityMode(isLow) {
	lowQualityMode = !!isLow;
	globalThis.LOW_QUALITY_MODE = lowQualityMode;
	frameRate(lowQualityMode ? 30 : 60);
}

function preload() {
	importDrawings();
	importSounds();
	preloadWeg();
}
function setup() {
	incinerateTimer = 0;
	doneIncinerating = BODY_EXIT_INCINERATE_MS;
	restartBuffer = 50;
	body2Setted = false;
	body3Setted = false;
	levelTime = 120000;
	
	w = BASE_W;
	h = BASE_H;
	wc = w/2;
	hc = h/2;
	easer = new p5.Ease();
	
	mainCanvas = createCanvas(w, h);
	mainCanvas.elt.getContext('2d', { willReadFrequently: true });
	setQualityMode(lowQualityMode);
	background(80);
	imageMode(CENTER);
	angleMode(DEGREES);
	colorMode(RGB, 255);
	
	//some various variables
	bodyWidth = wc;
	bodyHeight = hc-20;
	
	//for typing
	typable = true;
	typedWord = "";
	notif = "NOTIF NOT INITIALIZED";
	SCALPEL = 0;
	BONESAW = 1;
	toolName = ["SCALPEL", "BONESAW", "HAMMER", "ALKALINE", "LITHIUM"];
	toolCode = ["scalpel", "bonesaw", "hammer", "alkaline", "lithium"];
	errorNotif = "UNRECOGNIZABLE";
	ENTER = "Enter";
	SPACE = "Space";
	maxTextTime = 400;
	textTimer = 0;
	textDisplaySize = 200;
	textDisplayOpacity = 0.8;
	chrome = 0.004;
	brightnessBuffer = 400;
	
	//drawer logic
	r1isOpen = 0;
	r2isOpen = 0;
	r3isOpen = 0;
	
	//timer
	timeLeft = levelTime;
	timerDisplacementX = 550;
	timerDisplacementY = -300;
	
	//begin
	// bgm.play();
	
	bodyCount = 1;
	
	hasScalpel = true;
	hasBonesaw = true;
	hasHammer = true;
	
	incinerate = false;
	isTimeUp = false;
	
	framesCounted=0;
	
	setupWeg();
	if (typeof dragPanel !== "undefined" && typeof uiConfig !== "undefined" && uiConfig.panel) {
		dragPanel.offsetY = -uiConfig.panel.y1;
		dragPanel.prevOffsetY = dragPanel.offsetY;
		dragPanel.initialOffsetY = dragPanel.offsetY;
		dragPanel.returnAnimating = false;
	}
	applyResponsiveCanvasScale();
	
	scalpelInUse = false;
	bonesawInUse = false;
	hammerInUse = false;
	
	alkalineIsOpen = false;
	lithiumIsOpen = false;
	startScreenActive = true;
	startScreenStartMs = millis();
	timerIntroActive = true;
	timerIntroStartMs = startScreenStartMs;
	// Start screen starts with drawers closed.
	r1isOpen = 0;
	r2isOpen = 0;
	r3isOpen = 0;
	if (typeof setInteractionLockActive === "function") {
		setInteractionLockActive(false);
	}
	
}

function applyResponsiveCanvasScale() {
	const previewPanel = document.getElementById("camera-preview-panel");
	const availableW = previewPanel ? max(1, windowWidth * 0.5) : windowWidth;
	const scaleFactor = min(availableW / BASE_W, windowHeight / BASE_H);
	const displayW = floor(BASE_W * scaleFactor);
	const displayH = floor(BASE_H * scaleFactor);

	if (mainCanvas) {
		mainCanvas.style("width", displayW + "px");
		mainCanvas.style("height", displayH + "px");
		mainCanvas.style("position", "absolute");
		mainCanvas.style("left", ((availableW - displayW) / 2) + "px");
		mainCanvas.style("top", ((windowHeight - displayH) / 2) + "px");
		mainCanvas.elt.getContext('2d', { willReadFrequently: true });
	}

	document.body.style.margin = "0";
	document.body.style.overflow = "hidden";
	document.body.style.background = "black";
}

function windowResized() {
	applyResponsiveCanvasScale();
}

function getElasticSlidePosition(elapsedMs, fromY, toY) {
	const timer = map(min(elapsedMs - 600, 500), 0, 600, 0, 1);
	const pos = easer["elasticInOut"](timer, 0.85);
	return map(pos, 0, 1, fromY, toY);
}
function getElasticSegmentPosition(elapsedMs, durationMs, fromY, toY) {
	const t = constrain(elapsedMs / max(1, durationMs), 0, 1);
	const pos = easer["elasticInOut"](t, 0.85);
	return map(pos, 0, 1, fromY, toY);
}

function draw() {
	frameNowMs = millis();
	globalThis.panelMaskedPrompt = null;
	if (restartTransitionActive) {
		drawRestartTransition();
		return;
	}
	if (startScreenActive) {
		drawStartScreen();
		return;
	}
	if (forceAdvanceQueued) {
		forceAdvanceQueued = false;
		forceAdvanceStage();
	}
	if (checkPhasePending) {
		if (checkPhasePanelHideActive) {
			updateCheckPhasePanelHide();
		}
		if (frameNowMs >= checkPhaseStartAtMs && !checkPhasePanelHideActive) {
			beginCheckPhase();
		} else {
			drawCheckPhasePause();
			return;
		}
	}
	if (checkPhaseActive) {
		drawCheckPhase();
		return;
	}
	if (DEBUG_MODE && debugTimerPaused) {
		timeLeft = frameNowMs + debugPausedRemainingMs;
	}
	framesCounted++;
	let body1ReadyForGrab = false;
	let body2ReadyForGrab = false;
	let body3ReadyForGrab = false;
	image(bg, wc, hc);
	image(l1, wc, hc);
	image(l2, wc, hc);
	noStroke();
	if (noslidein)
		{
			if (bodyCount == 1) 
			{
				drawBody1(wc, hc);
				body1ReadyForGrab = true;
			}
			if (bodyCount == 2)
			{
			}
		}
	else
		{
			speed = BODY_ENTER_SPEED;
			t = getElasticSlidePosition(speed * framesCounted, -hc, hc);

			//circle(t, hc, 20);

			if (bodyCount == 1) 
			{
				if (!isTimeUp)
				{
					drawBody1(wc, t);
					body1ReadyForGrab = abs(t - hc) < 24;
				}
				else
					{
						speed = BODY_ENTER_SPEED;
						t = getElasticSlidePosition(speed * (frameNowMs - incinerateTimer), -hc, hc * 2);
						drawBody1(wc, t+hc);
						body1ReadyForGrab = false;
					}
			}
			else if (bodyCount == 2) 
			{
				if (!isTimeUp)
				{
					if (!body2Setted){
								setupBody2();
							body2Setted = true;
							}

					drawBody2(wc, t);
					body2ReadyForGrab = abs(t - hc) < 24;
				}
				else
					{
						speed = BODY_ENTER_SPEED;
						t = getElasticSlidePosition(speed * (frameNowMs - incinerateTimer), -hc, hc * 2);
						drawBody2(wc, t+hc);
						body2ReadyForGrab = false;
					}
			}
			else if (bodyCount == 3) 
			{
				if (!isTimeUp)
				{
					if (!body3Setted){
								setupBody3();
							body3Setted = true;
							}
					drawBody3(wc, t);
					body3ReadyForGrab = abs(t - hc) < 24;
				}
				else
					{
						speed = BODY_ENTER_SPEED;
						t = getElasticSlidePosition(speed * (frameNowMs - incinerateTimer), -hc, hc * 2);
						drawBody3(wc, t+hc);
						body3ReadyForGrab = false;
					}
			}
			
		}
	if (typeof setBodyGrabbablesActive === "function") {
		setBodyGrabbablesActive(1, body1ReadyForGrab);
		setBodyGrabbablesActive(2, body2ReadyForGrab);
		setBodyGrabbablesActive(3, body3ReadyForGrab);
	}
	const bodyReadyForGrab = (bodyCount === 1 && body1ReadyForGrab) || (bodyCount === 2 && body2ReadyForGrab) || (bodyCount === 3 && body3ReadyForGrab);
	const countdownRunning = !debugTimerPaused && !checkPhaseActive && !checkPhasePending && !isTimeUp && !incinerate && bodyReadyForGrab;
	if (!countdownRunning) {
		timeLeft += deltaTime;
	}
	image(chutes, wc, hc);
	
	xNoise = getXNoiseValue();
	yNoise = getYNoiseValue();
	chromaticOffset = chrome;
	
	//drawer logic
	push();
	translate(0, 50);
	if(alkalineIsOpen)
		{
			image(can1_open, wc + (lidTopJitterOffsetX || 0), hc + (lidTopJitterOffsetY || 0));
			can1_close.reset();
		}
	else
		{
			image(can1_close, wc + (lidTopJitterOffsetX || 0), hc + (lidTopJitterOffsetY || 0));
			can1_open.reset()
		}
	if(lithiumIsOpen)
		{
			image(can2_open, wc + (lidBottomJitterOffsetX || 0), hc + (lidBottomJitterOffsetY || 0));
			can2_close.reset()
		}
	else
		{
			image(can2_close, wc + (lidBottomJitterOffsetX || 0), hc + (lidBottomJitterOffsetY || 0));
			can2_open.reset()
		}
	if (scalpelInUse == true)
		{
			image(r1empty, wc, hc);
		}
	else if (r1isOpen == 1)
		{ 
		 	image(r1open, wc, hc);
			const scalpelG = getToolGrabbable("tool_scalpel");
			untoss(scalpelG);
			if (scalpelG) {
				scalpelG.active = true;
				scalpelG.isConsumed = false;
				scalpelG.visible = false;
				scalpelG.wasGrabbedLastFrame = false;
			}
			r1close.reset();
		}
	else if (r1isOpen == -1)
		{
			image(r1close, wc, hc);
			toss(getToolGrabbable("tool_scalpel"));
			r1open.reset();
		}
	else
		{
			image(r1, wc, hc);
		}
	
	if (bonesawInUse == true)
		{
			image(r2empty, wc, hc);
		}
	else if (r2isOpen == 1)
		{
		 	image(r2open, wc, hc);
			const bonesawG = getToolGrabbable("tool_bonesaw");
			untoss(bonesawG);
			if (bonesawG) {
				bonesawG.active = true;
				bonesawG.isConsumed = false;
				bonesawG.visible = false;
				bonesawG.wasGrabbedLastFrame = false;
			}
			r2close.reset();
		}
	else if (r2isOpen == -1)
		{
			image(r2close, wc, hc);
			toss(getToolGrabbable("tool_bonesaw"));
			r2open.reset();
		}
	else
		{
			image(r2, wc, hc);
		}
	if (hammerInUse == true)
		{
			image(r3empty, wc, hc);
		}
	else if (r3isOpen == 1)
		{
		 	image(r3open, wc, hc);
			const hammerG = getToolGrabbable("tool_hammer");
			untoss(hammerG);
			if (hammerG) {
				hammerG.active = true;
				hammerG.isConsumed = false;
				hammerG.visible = false;
				hammerG.wasGrabbedLastFrame = false;
			}
			r3close.reset();
		}
	else if (r3isOpen == -1)
		{
			image(r3close, wc, hc);
			toss(getToolGrabbable("tool_hammer"));
			r3open.reset();
		}
	else
		{
			image(r3, wc, hc);
		}
	
	image(rightCab, wc, hc);
	pop();
	drawWeg();
	noStroke();
	
	if (millis() <= textTimer) {
		textAlign(CENTER);
		textFont('Courier New', 10);
		// fill(0);
		// stroke(255);
		// strokeWeight(0.05*textDisplaySize);
		if (random()> 0.9)
		{
			xNoise = xNoise*10;
			yNoise = yNoise * 10;
			chromaticOffset = chrome*4;
		}
		let theText;
		if (typable)
		{
			textSize(textDisplaySize);
			theText = typedWord;
			fill(152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, 255, textDisplayOpacity*40);
			text(theText, (1-chromaticOffset)*wc+xNoise*30, (1-chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
			fill(255, 152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, textDisplayOpacity*50);
			text(theText, wc+xNoise*30, hc-0.5*textDisplaySize+yNoise*15);
			fill(84+xNoise*brightnessBuffer, 255, 152+xNoise*brightnessBuffer, textDisplayOpacity*255);
			text(theText, (1+chromaticOffset)*wc+xNoise*30, (1+chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
		}
		else {
			theText = notif;
			if (notif == errorNotif)
				{
					textSize(textDisplaySize*0.6);
					fill(152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, 255, textDisplayOpacity*40);
					text(theText, (1-chromaticOffset)*wc+xNoise*30, (1-chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
					fill(255, 152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, textDisplayOpacity*255);
					text(theText, wc+xNoise*30, hc-0.5*textDisplaySize+yNoise*15);
					fill(84+xNoise*brightnessBuffer, 255, 152+xNoise*brightnessBuffer, textDisplayOpacity*40);
					text(theText, (1+chromaticOffset)*wc+xNoise*30, (1+chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
				}
			else
				{
					textSize(textDisplaySize*0.8);
					fill(152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, 255, textDisplayOpacity*255);
					text(theText, (1-chromaticOffset)*wc+xNoise*30, (1-chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
					fill(255, 152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, textDisplayOpacity*50);
					text(theText, wc+xNoise*30, hc-0.5*textDisplaySize+yNoise*15);
					fill(84+xNoise*brightnessBuffer, 255, 152+xNoise*brightnessBuffer, textDisplayOpacity*55);
					text(theText, (1+chromaticOffset)*wc+xNoise*30, (1+chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
				}
		}
	}
	else {
		typable = true;
	}
	
	//timer
	secondsLeft = (int(((timeLeft - frameNowMs)/1000)));
	let timerYNow = timerDisplacementY;
	if (timerIntroActive) {
		const tElapsed = frameNowMs - timerIntroStartMs;
		timerYNow = getElasticSegmentPosition(tElapsed, START_SCREEN_TIMER_IN_MS, -900, timerDisplacementY);
		if (tElapsed >= START_SCREEN_TIMER_IN_MS) {
			timerIntroActive = false;
			timerYNow = timerDisplacementY;
		}
	}
	push();
	translate(timerDisplacementX, timerYNow);
	tint(255, 127);
	image(screen, wc-3, hc-147);
	tint(255, 255);
	image(clock, wc-3, hc-147);
	textAlign(CENTER);
	textFont('Courier New', 10);
	const isLoadingTransition = (!checkPhaseActive && !checkPhasePending) && (!bodyReadyForGrab || isTimeUp) && !incinerate;
	if (isLoadingTransition)
	{
		textSize(textDisplaySize*0.18);
		const loadingText = bodyCount > 3 ? "LOADING RESULTS" : "LOADING BODY";
		const flashOn = !(isTimeUp || incinerate) || (int(frameNowMs / 120) % 2 === 0);
		const baseA = flashOn ? 255 : 100;
		fill(182+xNoise*brightnessBuffer, 182+xNoise*brightnessBuffer, 255, baseA);
		text(loadingText, wc, hc-0.5*textDisplaySize-yNoise*15);
	}
	else if (secondsLeft >0)
	{
		textSize(textDisplaySize*0.3);
		milli = int(((timeLeft - frameNowMs)%1000)/60);
		theText = (secondsLeft + ":");
		if (milli < 10)
		{
			theText += "0";
		}
		theText += milli;
		fill(182+xNoise*brightnessBuffer, 182+xNoise*brightnessBuffer, 255, textDisplayOpacity*255);
		text(theText, (1-chromaticOffset)*wc+xNoise*30, (1-chromaticOffset)*hc-0.5*textDisplaySize-yNoise*15);
		fill(255, 182+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, textDisplayOpacity*50);
		text(theText, wc+xNoise*30, hc-0.5*textDisplaySize-yNoise*15);
		fill(84+xNoise*brightnessBuffer, 285, 152+xNoise*brightnessBuffer, textDisplayOpacity*55);
		text(theText, (1+chromaticOffset)*wc+xNoise*30, (1+chromaticOffset)*hc-0.5*textDisplaySize-yNoise*15);
	}
	else
	{
		textSize(textDisplaySize*0.35);
		theText = "00:00";
		xNoise = xNoise*10;
		yNoise = yNoise * 10;
		chromaticOffset = chrome*4;
		fill(152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, 255, textDisplayOpacity*50);
		text(theText, (1-chromaticOffset)*wc+xNoise*30, (1-chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
		fill(255, 152+xNoise*brightnessBuffer, 152+xNoise*brightnessBuffer, textDisplayOpacity*255);
		text(theText, wc+xNoise*30, hc-0.5*textDisplaySize+yNoise*15);
		fill(84+xNoise*brightnessBuffer, 255, 152+xNoise*brightnessBuffer, textDisplayOpacity*55);
		text(theText, (1+chromaticOffset)*wc+xNoise*30, (1+chromaticOffset)*hc-0.5*textDisplaySize+yNoise*15);
		
		timesUp();
	}
	pop();
	
	if (incinerate)
	{
		blendMode(ADD)
		tint(255, 255-(frameNowMs - incinerateTimer)/50);
		image(blowup, wc, hc)
		blendMode(BLEND)
		tint(255, 255);
		if (incinerateTimer == 0)
			{
				incinerateTimer = frameNowMs;
				blaze.play()
			}
		//print("incinerate timer upping");
		
		if(incinerateTimer + doneIncinerating <= frameNowMs)
			{
				//print("incinerate timer running");
				incinerate = false;
				timeLeft = frameNowMs + levelTime;
				incinerateTimer = 0;
				bodyCount++;
				if (bodyCount == 2)
					{
						if (typeof cleanupBodyUninteracted === "function") {
							cleanupBodyUninteracted("body1");
						}
						if (typeof resetToolsToDrawer === "function") {
							resetToolsToDrawer();
						}
					}
				else if (bodyCount == 3)
				{
					if (typeof cleanupBodyUninteracted === "function") {
						cleanupBodyUninteracted("body2");
					}
					if (typeof resetToolsToDrawer === "function") {
						resetToolsToDrawer();
					}
				}
				else if (bodyCount > 3) {
					if (typeof cleanupBodyUninteracted === "function") {
						cleanupBodyUninteracted("body3");
					}
					if (typeof resetToolsToDrawer === "function") {
						resetToolsToDrawer();
					}
					checkPhasePending = true;
					checkPhaseStartAtMs = frameNowMs + CHECK_START_DELAY_MS;
					checkPhasePanelHideActive = true;
					checkPhasePanelHideStartMs = frameNowMs;
					checkPhasePanelHideFromOffsetY = (typeof dragPanel !== "undefined") ? dragPanel.offsetY : 0;
				}
				framesCounted = restartBuffer;
				isTimeUp = false;
			}
	}
	else 
		{
			blowup.reset();
		}
	if (typeof drawAllDebugOverlays === "function") {
		drawAllDebugOverlays();
	}
}

function beginCheckPhase() {
	checkPhaseActive = true;
	checkPhasePending = false;
	checkPhaseDone = false;
	checkStage = "incoming";
	checkStageStartMs = frameNowMs;
	checkIncomingFrames = 0;
	checkOutgoingFrames = 0;
	checkIndex = 0;
	checkEvents = (typeof getBinSortReplayEvents === "function") ? getBinSortReplayEvents() : [];
	if (typeof setInteractionLockActive === "function") {
		setInteractionLockActive(true);
	}
	if (Array.isArray(grabbables)) {
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g) continue;
			g.isGrabbed = false;
			g.active = false;
			g.visible = false;
		}
	}
}

function drawStartScreen() {
	image(bg, wc, hc);
	image(l1, wc, hc);
	image(l2, wc, hc);
	image(chutes, wc, hc);
	drawCabinetUiForCheckPhase();
	const elapsed = frameNowMs - startScreenStartMs;
	if (typeof dragPanel !== "undefined" && typeof uiConfig !== "undefined" && uiConfig.panel) {
		if (elapsed <= START_SCREEN_PANEL_IN_MS) {
			const fromOffset = -uiConfig.panel.y1;
			dragPanel.offsetY = getElasticSegmentPosition(elapsed, START_SCREEN_PANEL_IN_MS, fromOffset, 0);
			dragPanel.prevOffsetY = dragPanel.offsetY;
		}
	}
	globalThis.panelMaskedPrompt = {
		jitter: 1.8,
		chromatic: 0.004,
		lineGap: 86,
		lines: [
			{ text: "MEMORY GARBAGE COLLECTION", size: textDisplaySize * 0.20, dy: -20 },
			{ text: "PRESS ANY KEY TO START", size: textDisplaySize * 0.11, dy: 24 }
		]
	};
	drawWeg();
	// Timer panel animates in from above.
	const timerY = getElasticSegmentPosition(elapsed, START_SCREEN_TIMER_IN_MS, -900, timerDisplacementY);
	push();
	noStroke();
	translate(timerDisplacementX, timerY);
	tint(255, 127);
	image(screen, wc-3, hc-147);
	tint(255, 255);
	image(clock, wc-3, hc-147);
	pop();

	if (typeof drawAllDebugOverlays === "function") {
		drawAllDebugOverlays();
	}
}

function drawCheckPhasePause() {
	image(bg, wc, hc);
	image(l1, wc, hc);
	image(l2, wc, hc);
	image(chutes, wc, hc);
	drawCabinetUiForCheckPhase();
	drawWeg();
	// Keep timer panel continuous during the body3->results pending gap.
	push();
	noStroke();
	translate(timerDisplacementX, timerDisplacementY);
	tint(255, 127);
	image(screen, wc-3, hc-147);
	tint(255, 255);
	image(clock, wc-3, hc-147);
	textAlign(CENTER);
	textFont("Courier New", 10);
	textSize(textDisplaySize * 0.18);
	const flashOn = (int(frameNowMs / 120) % 2 === 0);
	fill(182 + xNoise * brightnessBuffer, 182 + xNoise * brightnessBuffer, 255, flashOn ? 255 : 100);
	text("LOADING RESULTS", wc, hc - 0.5 * textDisplaySize);
	pop();
	if (typeof drawAllDebugOverlays === "function") {
		drawAllDebugOverlays();
	}
}

function drawCheckPhase() {
	image(bg, wc, hc);
	image(l1, wc, hc);
	image(l2, wc, hc);

	if (checkStage === "final_prompt") {
		globalThis.panelMaskedPrompt = {
			jitter: 1.8,
			chromatic: 0.004,
			lineGap: 90,
			lines: [
				{ text: "PRESS ANY KEY TO RESTART", size: textDisplaySize * 0.20, dy: 0 }
			]
		};
	}

	const summary = (typeof getBinSortSummary === "function")
		? getBinSortSummary()
		: { correct: 0, eligible: 0 };
	if (checkIndex >= checkEvents.length) {
		if (checkStage !== "final_score" && checkStage !== "final_prompt") {
			checkStage = "final_score";
			checkStageStartMs = frameNowMs;
		}
	}

	const evt = checkEvents[checkIndex] || null;
	const elapsed = frameNowMs - checkStageStartMs;
	const showItem = !!(evt && evt.pic && checkStage !== "result" && checkStage !== "final_score" && checkStage !== "final_prompt");
	let incinerateFxT = 0;
	if (showItem) {
		let drawY = hc;
		if (checkStage === "incoming") {
			drawY = getElasticSegmentPosition(elapsed, CHECK_INCOMING_MS, -hc, hc);
		}
		let drawScale = evt.scale || 1;
		if (checkStage === "incinerate") {
			checkOutgoingFrames++;
			const t = constrain(elapsed / CHECK_INCINERATE_MS, 0, 1);
			drawY = getElasticSegmentPosition(elapsed, CHECK_INCINERATE_MS, hc, h + 280);
			drawScale = evt.scale || 1;
			incinerateFxT = t;
		}
		if (checkStage === "incoming" && elapsed <= CHECK_ARRIVAL_JITTER_MS) {
			const jf = 1 - (elapsed / CHECK_ARRIVAL_JITTER_MS);
			drawY += random(-CHECK_ARRIVAL_JITTER_MAG, CHECK_ARRIVAL_JITTER_MAG) * jf;
		}
		push();
		translate(wc, drawY);
		image(bed, 0, 0);
		rotate(evt.rotation || 0);
		scale(drawScale);
		image(evt.pic, 0, 0);
		pop();
	}
	if (checkStage === "incinerate") {
		push();
		blendMode(ADD);
		tint(255, 220 - 180 * incinerateFxT);
		image(blowup, wc, hc);
		blendMode(BLEND);
		tint(255, 255);
		pop();
	}
	// Chutes remain above bed/item replay visuals.
	image(chutes, wc, hc);
	drawCabinetUiForCheckPhase();
	// Keep panel/claws and normal UI simulation active during check phase.
	drawWeg();

	// Reuse timer area as check/status display.
	push();
	noStroke();
	translate(timerDisplacementX, timerDisplacementY);
	tint(255, 127);
	image(screen, wc-3, hc-147);
	tint(255, 255);
	image(clock, wc-3, hc-147);
	textAlign(CENTER);
	textFont("Courier New", 10);
	if ((checkStage === "incoming" || checkStage === "hold") && evt) {
		textSize(textDisplaySize * 0.27);
		fill(190, 220, 255, 240);
		text(evt.placedTag || "lithium", wc, hc - 0.5 * textDisplaySize);
	} else if (checkStage === "result" && evt) {
		textSize(textDisplaySize * 0.30);
		fill(evt.correct ? color(120, 255, 120) : color(255, 80, 80));
		text(evt.correct ? "PASS" : "ERROR", wc, hc - 0.5 * textDisplaySize);
	} else if (checkStage === "final_score" || checkStage === "final_prompt") {
		textSize(textDisplaySize * 0.24);
		checkFinalText = `${summary.correct}/${summary.eligible}`;
		fill(220, 240, 255, 250);
		text(checkFinalText, wc, hc - 0.5 * textDisplaySize);
	}
	pop();
	// Stage stepping.
	if (checkStage === "incoming" && elapsed >= CHECK_INCOMING_MS) {
		checkStage = "hold";
		checkStageStartMs = frameNowMs;
		checkIncomingFrames = 0;
		checkOutgoingFrames = 0;
	} else if (checkStage === "hold" && elapsed >= CHECK_HOLD_MS) {
		checkStage = "incinerate";
		checkStageStartMs = frameNowMs;
		checkIncomingFrames = 0;
		checkOutgoingFrames = 0;
		blowup.reset();
		if (typeof blaze !== "undefined" && blaze && typeof blaze.play === "function") {
			blaze.play();
		}
	} else if (checkStage === "incinerate" && elapsed >= CHECK_INCINERATE_MS) {
		checkStage = "result";
		checkStageStartMs = frameNowMs;
		checkOutgoingFrames = 0;
	} else if (checkStage === "result" && elapsed >= CHECK_RESULT_MS) {
		checkIndex++;
		checkStage = "incoming";
		checkStageStartMs = frameNowMs;
		checkIncomingFrames = 0;
		checkOutgoingFrames = 0;
	} else if (checkStage === "final_score" && elapsed >= CHECK_FINAL_SCORE_HOLD_MS) {
		checkStage = "final_prompt";
		checkStageStartMs = frameNowMs;
		if (typeof setInteractionLockActive === "function") {
			setInteractionLockActive(false);
		}
	} else if (checkStage === "final_prompt") {
		const pElapsed = frameNowMs - checkStageStartMs;
		if (pElapsed <= CHECK_PANEL_SHOW_MS) {
			dragPanel.offsetY = getElasticSegmentPosition(pElapsed, CHECK_PANEL_SHOW_MS, -uiConfig.panel.y1, 0);
			dragPanel.prevOffsetY = dragPanel.offsetY;
		}
	}
	if (typeof drawAllDebugOverlays === "function") {
		drawAllDebugOverlays();
	}
}

function drawCabinetUiForCheckPhase() {
	push();
	translate(0, 50);
	if(alkalineIsOpen) {
		image(can1_open, wc + (lidTopJitterOffsetX || 0), hc + (lidTopJitterOffsetY || 0));
		can1_close.reset();
	} else {
		image(can1_close, wc + (lidTopJitterOffsetX || 0), hc + (lidTopJitterOffsetY || 0));
		can1_open.reset();
	}
	if(lithiumIsOpen) {
		image(can2_open, wc + (lidBottomJitterOffsetX || 0), hc + (lidBottomJitterOffsetY || 0));
		can2_close.reset();
	} else {
		image(can2_close, wc + (lidBottomJitterOffsetX || 0), hc + (lidBottomJitterOffsetY || 0));
		can2_open.reset();
	}
	if (scalpelInUse == true) {
		image(r1empty, wc, hc);
	} else if (r1isOpen == 1) {
		image(r1open, wc, hc);
		const scalpelG = getToolGrabbable("tool_scalpel");
		untoss(scalpelG);
		if (scalpelG) {
			scalpelG.active = true;
			scalpelG.isConsumed = false;
			scalpelG.visible = false;
			scalpelG.wasGrabbedLastFrame = false;
		}
		r1close.reset();
	} else if (r1isOpen == -1) {
		image(r1close, wc, hc);
		toss(getToolGrabbable("tool_scalpel"));
		r1open.reset();
	} else {
		image(r1, wc, hc);
	}
	if (bonesawInUse == true) {
		image(r2empty, wc, hc);
	} else if (r2isOpen == 1) {
		image(r2open, wc, hc);
		const bonesawG = getToolGrabbable("tool_bonesaw");
		untoss(bonesawG);
		if (bonesawG) {
			bonesawG.active = true;
			bonesawG.isConsumed = false;
			bonesawG.visible = false;
			bonesawG.wasGrabbedLastFrame = false;
		}
		r2close.reset();
	} else if (r2isOpen == -1) {
		image(r2close, wc, hc);
		toss(getToolGrabbable("tool_bonesaw"));
		r2open.reset();
	} else {
		image(r2, wc, hc);
	}
	if (hammerInUse == true) {
		image(r3empty, wc, hc);
	} else if (r3isOpen == 1) {
		image(r3open, wc, hc);
		const hammerG = getToolGrabbable("tool_hammer");
		untoss(hammerG);
		if (hammerG) {
			hammerG.active = true;
			hammerG.isConsumed = false;
			hammerG.visible = false;
			hammerG.wasGrabbedLastFrame = false;
		}
		r3close.reset();
	} else if (r3isOpen == -1) {
		image(r3close, wc, hc);
		toss(getToolGrabbable("tool_hammer"));
		r3open.reset();
	} else {
		image(r3, wc, hc);
	}
	image(rightCab, wc, hc);
	pop();
}

function timesUp(){
	isTimeUp = true;
	if (framesCounted > 900)
		{
			framesCounted = 0;
		}
	if (timeLeft - frameNowMs < 8000)
		{
			incinerate = true;
		}
}

function mouseClicked() {
	if (startScreenActive || (checkPhaseActive && checkStage === "final_prompt")) {
		requestRestartWithTransition();
		return false;
	}
	print(round(mouseX) + ", " + round(mouseY));
}

function scan(){
	return false;
}

function keyTyped() {
	if (DEBUG_MODE && key == " ") {
		// Space is handled in keyPressed for debug timer pause.
		return false;
	}
	if (key == " ")
		{
				typable = false;
				print("scanning");
			for (let i=0; i<grabbables.length; i++){
			let g = grabbables[i];
			if (g.isGrabbed){
				if (g.itemID%2 == 0)
					{
						notif = "Contains alkaline. Can recycle."
					}
				else 
					{
						notif = "Contains lithium. Dangerous."
					}
			}
		}
				entered(-2);
				typedWord = "";
		}
	else 
	if (key != ENTER)
  {
		if (millis() > textTimer)
			{
				typable = true;
			}
		if(typable)
			{
				typedWord = typedWord + key;
				print(typedWord);
				textTimer = millis() + maxTextTime;
			}
  }
	else if (key == ENTER)
	{
		if (typedWord == toolCode[SCALPEL])
    {
			typable = false;
			entered(SCALPEL);
  		typedWord = "";
    }
		else if (typedWord == toolCode[BONESAW])
    {
			typable = false;
			entered(BONESAW);
  		typedWord = "";
    }
		else if (typedWord == toolCode[2])
    {
			typable = false;
			entered(2);
  		typedWord = "";
    }
		else if (typedWord == toolCode[3])
    {
			typable = false;
			entered(3);
  		typedWord = "";
    }
		else if (typedWord == toolCode[4])
    {
			typable = false;
			entered(4);
  		typedWord = "";
    }
		else 
		{
			typable = false;
      print("input not recognized");
			notif=errorNotif;
			entered(-1);
  		typedWord = "";
		}
	}
}

function keyPressed() {
	if (key === "1") {
		setQualityMode(false);
		return false;
	}
	if (key === "2") {
		setQualityMode(true);
		return false;
	}
	if (startScreenActive) {
		requestRestartWithTransition();
		return false;
	}
	if (checkPhaseActive && checkStage === "final_prompt") {
		requestRestartWithTransition();
		return false;
	}
	if (keyCode === 32) { // Space
		debugTimerPaused = !debugTimerPaused;
		if (debugTimerPaused) {
			debugPausedRemainingMs = max(0, timeLeft - frameNowMs);
		} else {
			timeLeft = frameNowMs + debugPausedRemainingMs;
		}
		return false;
	}

	if (keyCode === RIGHT_ARROW) {
		// Advance to next stage regardless of current stage.
		forceAdvanceQueued = true;
		return false;
	}

	if (keyCode === ESCAPE) {
		requestRestartWithTransition();
		return false;
	}
}

function restartGameInPlace() {
	// Backward compatibility entrypoint.
	requestRestartWithTransition();
}

function restartGameInPlaceCore() {
	loop();
	incinerateTimer = 0;
	doneIncinerating = BODY_EXIT_INCINERATE_MS;
	body2Setted = false;
	body3Setted = false;
	timeLeft = millis() + levelTime;
	bodyCount = 1;
	isTimeUp = false;
	incinerate = false;
	framesCounted = 0;
	checkPhaseActive = false;
	checkPhaseDone = false;
	checkPhasePending = false;
	checkPhaseStartAtMs = 0;
	checkPhasePanelHideActive = false;
	checkPhasePanelHideStartMs = 0;
	checkPhasePanelHideFromOffsetY = 0;
	checkEvents = [];
	checkIndex = 0;
	checkStage = "incoming";
	checkStageStartMs = millis();
	checkFinalText = "";
	checkIncomingFrames = 0;
	checkOutgoingFrames = 0;
	forceAdvanceQueued = false;
	restartTransitionActive = false;
	restartTransitionStartMs = 0;
	startScreenActive = false;
	startScreenStartMs = 0;
	timerIntroActive = true;
	timerIntroStartMs = millis();
	debugTimerPaused = false;
	debugPausedRemainingMs = 0;
	typable = true;
	typedWord = "";
	textTimer = 0;
	notif = "NOTIF NOT INITIALIZED";
	r1isOpen = 0;
	r2isOpen = 0;
	r3isOpen = 0;
	scalpelInUse = false;
	bonesawInUse = false;
	hammerInUse = false;
	alkalineIsOpen = false;
	lithiumIsOpen = false;
	if (typeof setInteractionLockActive === "function") {
		setInteractionLockActive(false);
	}
	if (typeof resetWegGameState === "function") {
		resetWegGameState();
	}
	if (typeof dragPanel !== "undefined" && typeof uiConfig !== "undefined" && uiConfig.panel) {
		dragPanel.offsetY = -uiConfig.panel.y1;
		dragPanel.prevOffsetY = dragPanel.offsetY;
		dragPanel.initialOffsetY = dragPanel.offsetY;
		dragPanel.returnAnimating = false;
		dragPanel.returnFrame = 0;
		dragPanel.wasAtVerticalBound = false;
	}
}

function requestRestartWithTransition() {
	if (restartTransitionActive) return;
	restartTransitionActive = true;
	restartTransitionStartMs = frameNowMs || millis();
	restartTransitionTimerFromY = timerDisplacementY;
	restartTransitionBodyFromY = (typeof bedTrackY === "number") ? bedTrackY : hc;
	restartTransitionPanelFromOffsetY = (typeof dragPanel !== "undefined") ? dragPanel.offsetY : 0;
	restartTransitionAnimateBody = (!startScreenActive && bodyCount >= 1 && bodyCount <= 3 && restartTransitionBodyFromY > -hc && restartTransitionBodyFromY < h + hc);
	restartTransitionDelayTimer = !!(startScreenActive || (checkPhaseActive && checkStage === "final_prompt"));
	if (r1isOpen === 1) r1isOpen = -1;
	if (r2isOpen === 1) r2isOpen = -1;
	if (r3isOpen === 1) r3isOpen = -1;
	alkalineIsOpen = false;
	lithiumIsOpen = false;
}

function drawRestartTransition() {
	const now = frameNowMs || millis();
	const elapsed = now - restartTransitionStartMs;
	const t = constrain(elapsed / RESTART_TRANSITION_MS, 0, 1);
	const bodyY = getElasticSegmentPosition(elapsed, RESTART_TRANSITION_MS, restartTransitionBodyFromY, h + (hc * 2.5));
	image(bg, wc, hc);
	image(l1, wc, hc);
	image(l2, wc, hc);
	if (restartTransitionAnimateBody) {
		if (bodyCount === 1) drawBody1(wc, bodyY);
		else if (bodyCount === 2) drawBody2(wc, bodyY);
		else if (bodyCount === 3) drawBody3(wc, bodyY);
	}
	image(chutes, wc, hc);
	drawCabinetUiForCheckPhase();
	if (typeof dragPanel !== "undefined" && typeof uiConfig !== "undefined" && uiConfig.panel) {
		dragPanel.offsetY = getElasticSegmentPosition(elapsed, RESTART_TRANSITION_MS, restartTransitionPanelFromOffsetY, -uiConfig.panel.y1);
		dragPanel.prevOffsetY = dragPanel.offsetY;
	}
	if (typeof drawWeg === "function") drawWeg();
	const timerElapsed = restartTransitionDelayTimer ? max(0, elapsed - RESTART_TIMER_DELAY_MS) : elapsed;
	push();
	translate(timerDisplacementX, getElasticSegmentPosition(timerElapsed, RESTART_TRANSITION_MS, restartTransitionTimerFromY, -900));
	tint(255, 127);
	image(screen, wc-3, hc-147);
	tint(255, 255);
	image(clock, wc-3, hc-147);
	pop();
	if (t >= 1) {
		restartTransitionActive = false;
		restartTransitionAnimateBody = false;
		restartGameInPlaceCore();
	}
}

function updateCheckPhasePanelHide() {
	if (!checkPhasePanelHideActive || typeof uiConfig === "undefined" || !uiConfig.panel || typeof dragPanel === "undefined") return;
	const elapsed = frameNowMs - checkPhasePanelHideStartMs;
	const nextOffset = getElasticSegmentPosition(elapsed, CHECK_START_DELAY_MS, checkPhasePanelHideFromOffsetY, -uiConfig.panel.y1);
	dragPanel.offsetY = nextOffset;
	dragPanel.prevOffsetY = nextOffset;
	if (elapsed >= CHECK_START_DELAY_MS) {
		dragPanel.offsetY = -uiConfig.panel.y1;
		dragPanel.prevOffsetY = dragPanel.offsetY;
		checkPhasePanelHideActive = false;
	}
}

function forceAdvanceStage() {
	debugTimerPaused = false;
	debugPausedRemainingMs = 0;
	if (checkPhasePending) {
		beginCheckPhase();
		return;
	}
	if (checkPhaseActive) {
		if (checkStage === "incoming") {
			checkStage = "hold";
			checkStageStartMs = frameNowMs;
			return;
		}
		if (checkStage === "hold") {
			checkStage = "incinerate";
			checkStageStartMs = frameNowMs;
			blowup.reset();
			if (typeof blaze !== "undefined" && blaze && typeof blaze.play === "function") blaze.play();
			return;
		}
		if (checkStage === "incinerate") {
			checkStage = "result";
			checkStageStartMs = frameNowMs;
			return;
		}
		if (checkStage === "result") {
			checkIndex++;
			checkStage = "incoming";
			checkStageStartMs = frameNowMs;
			checkIncomingFrames = 0;
			checkOutgoingFrames = 0;
			return;
		}
		if (checkStage === "final_score") {
			checkStage = "final_prompt";
			checkStageStartMs = frameNowMs;
			return;
		}
		if (checkStage === "final_prompt") {
			requestRestartWithTransition();
			return;
		}
		return;
	}
	if (incinerate) {
		incinerateTimer = frameNowMs - doneIncinerating - 1;
		return;
	}
	if (isTimeUp) {
		incinerate = true;
		if (incinerateTimer === 0) {
			incinerateTimer = frameNowMs;
		}
		return;
	}
	timeLeft = frameNowMs;
	timesUp();
}

function entered(tool)
{
	textTimer = millis() + 2*maxTextTime;
	if (tool >= 0)
	{
		print(toolName[tool]);
		notif = toolName[tool];
		if (tool == SCALPEL)
		{
			if (r1isOpen == 1)
			{
				drawerClose.play();
				toss(getToolGrabbable("tool_scalpel"));
				r1isOpen = -1;
			}
			else {
				drawerOpen.play();
				r1isOpen = 1;
			}
		}
		else if (tool == BONESAW)
		{
			if (r2isOpen == 1)
			{
				drawerClose.play();
				toss(getToolGrabbable("tool_bonesaw"));
				r2isOpen = -1;
			}
			else {
				drawerOpen.play();
				r2isOpen = 1;
			}
		}
		if (tool == 2)
		{
			if (r3isOpen == 1)
			{
				drawerClose.play();
				toss(getToolGrabbable("tool_hammer"));
				r3isOpen = -1;
			}
			else {
				drawerOpen.play();
				r3isOpen = 1;
			}
		}
		if (tool == 3)
		{
			if (alkalineIsOpen)
			{
				drawerClose.play();
				alkalineIsOpen = false;
			}
			else {
				drawerOpen.play();
				alkalineIsOpen = true;
			}
		}
		if (tool == 4)
		{
			if (lithiumIsOpen)
			{
				drawerClose.play();
				lithiumIsOpen = false;
			}
			else {
				drawerOpen.play();
				lithiumIsOpen = true;
			}
		}
	}
	if (tool = -2)
	{
		for (let i=0; i<grabbables.length; i++){
			let g = grabbables[i];
			if (g.isGrabbed){
				if (g.itemID%2 == 0)
					{
						notif = "Contains alkaline. Can recycle."
					}
				else 
					{
						notif = "Contains lithium. Dangerous."
					}
			}
		}
	}
	else
	{
		notif = errorNotif;
	}
	
}

function drawBody1(x, y) {
	bedTrackX = x;
	bedTrackY = y;
	bedTrackBody = 1;
	const hasArm = !hasModelItemBeenInteracted("b1_arm");
	const hasLeg = !hasModelItemBeenInteracted("b1_leg");
	const hasEyeball = !hasModelHitboxBeenGrabbed("b1_eye_ball");
	const hasEyelid = !hasModelHitboxBeenGrabbed("b1_eye_lid");
	const hasFlap = !hasModelItemBeenInteracted("b1_flap");
	image(bed, x, y);
	image(body1, x, y);
	if (hasArm)
		{
			image(body1arm, x, y);
		}
	if (hasLeg)
		{
			image(body1leg, x, y);
		}
	if (hasEyeball)
		{
			image(body1eyeball, x, y);
		}
	if (hasEyelid)
		{
			image(body1eyelid, x, y);
			if (!hasEyeball)
				{
					print("has eyelid but no eyeball?? bug");
				}
		}
	if (hasFlap)
		{
			image(body1flap, x, y);
		}
}

function drawBody2(x, y) {
	bedTrackX = x;
	bedTrackY = y;
	bedTrackBody = 2;
	const hasKnee = !hasModelItemBeenInteracted("b2_knee");
	const hasHand = !hasModelItemBeenInteracted("b2_hand");
	const hasHeart = !hasModelItemBeenInteracted("b2_heart");
	const hasRibs = !hasModelItemBeenInteracted("b2_rib");
	const hasSkin = !hasModelItemBeenInteracted("b2_skin");
	const hasFlap = !hasModelItemBeenInteracted("b2_flap");
  image(bed, x, y);
  image(body2, x, y);
  	  if(hasKnee)
    {
		  const kneeJig = (typeof getBodyPartJiggleOffset === "function") ? getBodyPartJiggleOffset("b2_knee") : { x: 0, y: 0 };
		  image(body2knee, x + kneeJig.x, y + kneeJig.y);
    }
	else
		{
			image(body2blood, x, y);
		}

	if(hasHand)
    {
      image(body2hand, x, y);
    }
	if (!hasSkin){
	if(hasHeart)
		{
			image(body2heart, x, y);
		}
		else {
			image(body2empty, x, y);
		}
	if(hasRibs)
		{
		image(body2ribs, x, y);
		}
	}


  if(hasFlap)
    {
      image(body2flap, x, y);
    }
}

function drawBody3(x, y) {
	bedTrackX = x;
	bedTrackY = y;
	bedTrackBody = 3;
	const hasFoot = !hasModelItemBeenInteracted("b3_foot");
	const hasSkull = !hasModelItemBeenInteracted("b3_skull");
	const hasGuts = !hasModelItemBeenInteracted("b3_guts");
	const hasSkin = !hasModelItemBeenInteracted("b3_skin");
	const hasBrain = !hasModelItemBeenInteracted("b3_brain");
	const hasFlap = !hasModelItemBeenInteracted("b3_flap");
  image(bed, x, y)
  image(body3, x, y);
	if(!hasSkull)
		{
			image(body3blood,x,y);
		}
  if(hasFoot)
    {
      image(body3foot, x, y);
    }
  if(hasGuts && (!hasSkin))
    {
      image(body3guts, x, y);
    }
	if(!hasGuts)
		{
			image(body3empty, x, y);
		}
  if(hasBrain && (!hasSkull))
    {
      image(body3brain, x, y);
    }
	if(!hasBrain)
		{
			image(body3dummy, x, y)
		}
	if(hasFlap)
	{
		image(body3flap, x, y);
	}
}

function getXNoiseValue() { 
  let v = noise(frameNowMs / 100);
  const cutOff = 0.5;
  
  if(v < cutOff) {
    return 0;
  }
  
  v = pow((v-cutOff) * 1/(1-cutOff), 2);
  
  return v;
}
function getYNoiseValue() { 
  let v = noise((frameNowMs + 500) / 100);
  const cutOff = 0.5;
  
  if(v < cutOff) {
    return 0;
  }
  
  v = pow((v-cutOff) * 1/(1-cutOff), 2);
  
  return v;
}

function importDrawings() {
	bg = loadImage("assets/images/ui/background.gif");
	body1 = loadImage("assets/images/bodies/body1.png");
	body1arm = loadImage("assets/images/bodies/body1_arm.png");
	body1leg = loadImage("assets/images/bodies/body1_leg.png");
	body1eyeball = loadImage("assets/images/bodies/body1_eyeball.png");
	body1eyelid = loadImage("assets/images/bodies/body1_eyelid.png");
	body1flap = loadImage("assets/images/bodies/body1_flap.png");
	body1arm_severed = loadImage("assets/images/bodies/b1arm_severed.png");
	body1eyeball_severed = loadImage("assets/images/bodies/b1eyeball_severed.png");
	body1leg_severed = loadImage("assets/images/bodies/b1leg_severed.png");
	
	body2 = loadImage("assets/images/bodies/body2.png");
	body2hand = loadImage("assets/images/bodies/body2_hand.png");
	body2knee = loadImage("assets/images/bodies/body2_knee.png");
	body2blood = loadImage("assets/images/bodies/body2_blood.png");
	body2ribs = loadImage("assets/images/bodies/body2_ribs.png");
	body2heart = loadImage("assets/images/bodies/body2_heart.png");
	body2empty = loadImage("assets/images/bodies/body2_empty.png");
	body2flap = loadImage("assets/images/bodies/body2_flap.png");
	body2_knee_severed = loadImage("assets/images/bodies/body2_knee_severed.png");
	body2_hand_severed = loadImage("assets/images/bodies/body2_hand_severed.png");
	body2_heart_severed = loadImage("assets/images/bodies/body2_heart_severed.png");
	
	body3 = loadImage("assets/images/bodies/body3.png");
	body3blood = loadImage("assets/images/bodies/body3_blood.png");
	body3foot = loadImage("assets/images/bodies/body3_foot.png");
	body3guts = loadImage("assets/images/bodies/body3_guts.png");
	body3empty = loadImage("assets/images/bodies/body3_empty.png");
	body3flap = loadImage("assets/images/bodies/body3_flap.png");
	body3brain = loadImage("assets/images/bodies/body3_brain.png");
	body3dummy = loadImage("assets/images/bodies/body3_dummy.png");
	body3_guts_severed = loadImage("assets/images/bodies/body3_guts_severed.png");
	body3_foot_severed = loadImage("assets/images/bodies/body3_foot_severed.png");
	body3_brain_severed = loadImage("assets/images/bodies/body3_brain_severed.png");
	body1_xray = loadImage("assets/images/bodies/body1_xray.png");
	body2_xray = loadImage("assets/images/bodies/body2_xray.png");
	body3_xray = loadImage("assets/images/bodies/body3_xray.png");
	
	rightCab = loadImage("assets/images/ui/right_cabinet.png");
	r1open = loadImage("assets/images/ui/top_right_open2.gif");
	r1close = loadImage("assets/images/ui/top_right_close2.gif");
	r1 = loadImage("assets/images/ui/top_right.png");
	r1empty = loadImage("assets/images/ui/top_right_empty.png")
	r2open = loadImage("assets/images/ui/mid_right_open2.gif");
	r2close = loadImage("assets/images/ui/mid_right_close2.gif");
	r2 = loadImage("assets/images/ui/mid_right.png");
	r2empty = loadImage("assets/images/ui/mid_right_empty.png");
	r3open = loadImage("assets/images/ui/low_right_open2.gif");
	r3close = loadImage("assets/images/ui/low_right_close2.gif");
	r3 = loadImage("assets/images/ui/low_right.png");
	r3empty = loadImage("assets/images/ui/low_right_empty.png");
	clock = loadImage("assets/images/ui/timer.gif");
	screen = loadImage("assets/images/ui/screen.gif");
	bed = loadImage("assets/images/ui/bed.png");
	background_xray = loadImage("assets/images/ui/background_xray.png");
	l1 = loadImage("assets/images/ui/top_left.png");
	l2 = loadImage("assets/images/ui/low_left.png");
	chutes = loadImage("assets/images/ui/chutes.png");
	
	openclaw = loadImage("assets/images/tools/pliers.png");
	closedclaw = loadImage("assets/images/tools/pliersclosed.png");
	
	hammer = loadImage("assets/images/tools/hammer.png");
	bonesaw = loadImage("assets/images/tools/bonesaw.png");
	scalpel = loadImage("assets/images/tools/scalpel.png");
	panelOverlay = loadImage("assets/images/tools/panel.png");
	
	blowup = loadImage("assets/images/effects/blowup.gif");
	can2_open = loadImage("assets/images/effects/can2_open.gif");
	can1_open = loadImage("assets/images/effects/can1_open.gif");
	can1_close = loadImage("assets/images/effects/can1_close.gif");
	can2_close = loadImage("assets/images/effects/can2_close.gif");
}

function importSounds() {
	bgm = createAudio('assets/audio/Ambience.mp3');
	bgm.volume(0.4);
	drawerOpen = loadSound('assets/audio/drawerOpen.mp3');
	drawerClose = loadSound('assets/audio/drawerClose.mp3');
	
	rustle = loadSound('assets/audio/rustle1.mp3')
	rustleL = loadSound('assets/audio/longRustle.mp3')
	pickup = loadSound('assets/audio/clipboardPickup.mp3')
	pickupL = loadSound('assets/audio/randomPickup.mp3')
	blaze = loadSound('assets/audio/9jdd4s_1.mp3')
	bonesawLoopSfx = loadSound('assets/audio/Bonesaw.mp3')
	hammerBoneLoopSfx = loadSound('assets/audio/Hammer Hit Bone.mp3')
	hammerMetalLoopSfx = loadSound('assets/audio/Hammer Hit Metal.mp3')
	scalpelLoopSfx = loadSound('assets/audio/Scalpel.mp3')

	metalWrong = loadSound('assets/audio/Metal Wrong Rattle.mp3')
}

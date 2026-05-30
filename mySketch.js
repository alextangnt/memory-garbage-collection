noslidein = false;
let mainCanvas;
const BASE_W = 1620;
const BASE_H = 1080;
let bedTrackX = 0;
let bedTrackY = 0;
let bedTrackBody = 1;
let frameNowMs = 0;
const DEBUG_MODE = false; // Toggle debug controls here.
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
let checkPhaseActive = false;
let checkPhaseDone = false;
let checkPhasePending = false;
let checkPhaseStartAtMs = 0;
let checkEvents = [];
let checkIndex = 0;
let checkStage = "incoming"; // "incoming" | "hold" | "incinerate" | "result" | "final"
let checkStageStartMs = 0;
let checkFinalText = "";
let checkIncomingFrames = 0;
let checkOutgoingFrames = 0;

function preload() {
	importDrawings();
	importSounds();
	preloadWeg();
}
function setup() {
	incinerateTimer = 0;
	doneIncinerating = 3000;
	restartBuffer = 50;
	body2Setted = false;
	body3Setted = false;
	levelTime = 40000;
	
	w = BASE_W;
	h = BASE_H;
	wc = w/2;
	hc = h/2;
	easer = new p5.Ease();
	
	mainCanvas = createCanvas(w, h);
	mainCanvas.elt.getContext('2d', { willReadFrequently: true });
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
	
}

function applyResponsiveCanvasScale() {
	const scaleFactor = min(windowWidth / BASE_W, windowHeight / BASE_H);
	const displayW = floor(BASE_W * scaleFactor);
	const displayH = floor(BASE_H * scaleFactor);

	if (mainCanvas) {
		mainCanvas.style("width", displayW + "px");
		mainCanvas.style("height", displayH + "px");
		mainCanvas.style("position", "absolute");
		mainCanvas.style("left", ((windowWidth - displayW) / 2) + "px");
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
	if (checkPhasePending) {
		if (frameNowMs >= checkPhaseStartAtMs) {
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
	push();
	translate(timerDisplacementX, timerDisplacementY);
	tint(255, 127);
	image(screen, wc-3, hc-147);
	tint(255, 255);
	image(clock, wc-3, hc-147);
	textAlign(CENTER);
	textFont('Courier New', 10);
	if (secondsLeft >0)
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

function drawCheckPhasePause() {
	image(bg, wc, hc);
	image(l1, wc, hc);
	image(l2, wc, hc);
	image(chutes, wc, hc);
	drawCabinetUiForCheckPhase();
	drawWeg();
	if (typeof drawAllDebugOverlays === "function") {
		drawAllDebugOverlays();
	}
}

function drawCheckPhase() {
	image(bg, wc, hc);
	image(l1, wc, hc);
	image(l2, wc, hc);

	const summary = (typeof getBinSortSummary === "function")
		? getBinSortSummary()
		: { correct: 0, eligible: 0 };
	if (checkIndex >= checkEvents.length) {
		checkStage = "final";
	}

	const evt = checkEvents[checkIndex] || null;
	const elapsed = frameNowMs - checkStageStartMs;
	const showItem = !!(evt && evt.pic && checkStage !== "result" && checkStage !== "final");
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
	} else if (checkStage === "final") {
		textSize(textDisplaySize * 0.24);
		fill(220, 240, 255, 250);
		checkFinalText = `${summary.correct}/${summary.eligible}`;
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
	} else if (checkStage === "final" && !checkPhaseDone) {
		checkPhaseDone = true;
		noLoop();
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
		r1close.reset();
	} else if (r1isOpen == -1) {
		image(r1close, wc, hc);
		r1open.reset();
	} else {
		image(r1, wc, hc);
	}
	if (bonesawInUse == true) {
		image(r2empty, wc, hc);
	} else if (r2isOpen == 1) {
		image(r2open, wc, hc);
		r2close.reset();
	} else if (r2isOpen == -1) {
		image(r2close, wc, hc);
		r2open.reset();
	} else {
		image(r2, wc, hc);
	}
	if (hammerInUse == true) {
		image(r3empty, wc, hc);
	} else if (r3isOpen == 1) {
		image(r3open, wc, hc);
		r3close.reset();
	} else if (r3isOpen == -1) {
		image(r3close, wc, hc);
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
	if (!DEBUG_MODE) {
		return;
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
		// Force only the current timer to end and run normal body exit/advance flow.
		debugTimerPaused = false;
		debugPausedRemainingMs = 0;
		timeLeft = frameNowMs;
		timesUp();
		return false;
	}

	if (keyCode === ESCAPE) {
		// Full game restart.
		window.location.reload();
		return false;
	}
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
      image(body2knee, x, y);
    }
	else
		{
			image(body2blood, x, y);
		}
	if(hasHand)
    {
      image(body2hand, x, y);
    }
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
	if(hasSkin)
		{
			image(body2, x, y);
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
}

<script>
	// toast-beta-1: hue shift
	// вход: изображение + hue-delta, выход: изображение

	let hueDelta = $state(0);
	let sourceImageData = $state(null);

	let canvasEl;

	function rgbToHsl(r, g, b) {
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h = 0;
		let s = 0;
		const l = (max + min) / 2;

		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

			switch (max) {
				case r:
					h = (g - b) / d + (g < b ? 6 : 0);
					break;
				case g:
					h = (b - r) / d + 2;
					break;
				case b:
					h = (r - g) / d + 4;
					break;
			}
			h /= 6;
		}

		return [h, s, l];
	}

	function hslToRgb(h, s, l) {
		if (s === 0) return [l, l, l];

		const hue2rgb = (p, q, t) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;

		return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
	}

	function applyHueShift(imageData, deltaDeg) {
		const src = imageData.data;
		const out = new Uint8ClampedArray(src.length);
		const deltaNorm = deltaDeg / 360;

		for (let i = 0; i < src.length; i += 4) {
			const r = src[i] / 255;
			const g = src[i + 1] / 255;
			const b = src[i + 2] / 255;

			let [h, s, l] = rgbToHsl(r, g, b);
			h = (h + deltaNorm + 1) % 1;
			const [nr, ng, nb] = hslToRgb(h, s, l);

			out[i] = Math.round(nr * 255);
			out[i + 1] = Math.round(ng * 255);
			out[i + 2] = Math.round(nb * 255);
			out[i + 3] = src[i + 3];
		}

		return new ImageData(out, imageData.width, imageData.height);
	}

	function render() {
		if (!sourceImageData || !canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		const shifted = applyHueShift(sourceImageData, hueDelta);
		ctx.putImageData(shifted, 0, 0);
	}

	function onFileChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;

		const objectUrl = URL.createObjectURL(file);
		const img = new Image();

		img.onload = () => {
			canvasEl.width = img.naturalWidth;
			canvasEl.height = img.naturalHeight;

			const ctx = canvasEl.getContext('2d');
			ctx.drawImage(img, 0, 0);
			sourceImageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);

			URL.revokeObjectURL(objectUrl);
		};

		img.src = objectUrl;
	}

	function onExport() {
		if (!canvasEl) return;

		canvasEl.toBlob((blob) => {
			if (!blob) return;

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'toast-beta-1.png';
			a.click();
			URL.revokeObjectURL(url);
		}, 'image/png');
	}

	$effect(() => {
		render();
	});
</script>

<h1>toast-beta-1: hue shift</h1>

<div>
	<label>
		изображение:
		<input type="file" accept="image/*" onchange={onFileChange} />
	</label>
</div>

<div>
	<label>
		hue-delta: {hueDelta}°
		<input type="range" min="-180" max="180" step="1" bind:value={hueDelta} />
	</label>
</div>

<div>
	<button onclick={onExport} disabled={!sourceImageData}>экспорт</button>
</div>

<canvas bind:this={canvasEl}></canvas>

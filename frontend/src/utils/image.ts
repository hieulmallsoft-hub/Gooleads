import { IMAGE_RATIO_TOLERANCE } from '../config/googleAds';
import type {
  Asset,
  ImageAspectSpec,
  ReplacementImageInfo,
} from '../types/googleAds';

export function getReplacementImageSpec(asset: Asset | null): ImageAspectSpec {
  const fieldType = `${asset?.fieldType ?? ''}`.toUpperCase();
  let spec: ImageAspectSpec;

  if (fieldType.includes('TALL_PORTRAIT')) {
    spec = { label: '9:16 tall portrait', ratio: 9 / 16, minWidth: 600, minHeight: 1067 };
  } else if (fieldType.includes('PORTRAIT')) {
    spec = { label: '4:5 portrait', ratio: 4 / 5, minWidth: 480, minHeight: 600 };
  } else if (fieldType.includes('SQUARE') || fieldType.includes('LOGO')) {
    spec = { label: '1:1 square', ratio: 1, minWidth: 300, minHeight: 300 };
  } else {
    spec = { label: '1.91:1 landscape', ratio: 1.91, minWidth: 600, minHeight: 314 };
  }

  if (asset?.imageWidth && asset?.imageHeight) {
    return {
      ...spec,
      label: `selected asset ratio ${asset.imageWidth}x${asset.imageHeight}`,
      ratio: asset.imageWidth / asset.imageHeight,
    };
  }

  return spec;
}

function getImageSize(file: File) {
  return new Promise<{ width: number; height: number; image: HTMLImageElement }>((resolve, reject) => {
    const image = new window.Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight, image });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read replacement image dimensions'));
    };
    image.src = url;
  });
}

export async function normalizeImageForGoogleAds(file: File, spec: ImageAspectSpec) {
  const { width, height, image } = await getImageSize(file);
  const originalRatio = width / height;
  const matchesRatio = Math.abs(originalRatio / spec.ratio - 1) <= IMAGE_RATIO_TOLERANCE;
  const largeEnough = width >= spec.minWidth && height >= spec.minHeight;
  const info: ReplacementImageInfo = {
    originalWidth: width,
    originalHeight: height,
    outputWidth: width,
    outputHeight: height,
    specLabel: spec.label,
    adjusted: !matchesRatio || !largeEnough,
  };

  if (!info.adjusted) {
    return { file, info };
  }

  let sourceWidth = width;
  let sourceHeight = height;
  let sourceX = 0;
  let sourceY = 0;

  if (originalRatio > spec.ratio) {
    sourceWidth = height * spec.ratio;
    sourceX = (width - sourceWidth) / 2;
  } else {
    sourceHeight = width / spec.ratio;
    sourceY = (height - sourceHeight) / 2;
  }

  let outputWidth = Math.max(spec.minWidth, Math.round(sourceWidth));
  let outputHeight = Math.round(outputWidth / spec.ratio);

  if (outputHeight < spec.minHeight) {
    outputHeight = spec.minHeight;
    outputWidth = Math.round(outputHeight * spec.ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not prepare replacement image for Google Ads');
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Could not crop replacement image'));
    }, 'image/png');
  });
  const safeName = file.name.replace(/\.[^.]+$/, '') || 'replacement-image';

  return {
    file: new File([blob], `${safeName}-${spec.label.replace(/[^\w]+/g, '-').toLowerCase()}.png`, {
      type: 'image/png',
    }),
    info: {
      ...info,
      outputWidth,
      outputHeight,
    },
  };
}

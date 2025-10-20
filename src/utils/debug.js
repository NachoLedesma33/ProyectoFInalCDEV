// Debug utility to check if an image exists
export function checkImageExists(url, callback) {
  const img = new Image();
  
  img.onload = function() {
    console.log('Image loaded successfully:', url);
    if (typeof callback === 'function') callback(true);
  };
  
  img.onerror = function() {
    console.error('Failed to load image:', url);
    if (typeof callback === 'function') callback(false);
  };
  
  img.src = url;
}

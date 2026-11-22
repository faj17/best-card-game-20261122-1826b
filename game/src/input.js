// Mouse + keyboard input for the table. Click a hand card to play it
// (or a board minion to arm it, then an enemy to strike); keys 1-7 play a
// hand card, Space ends the turn, Enter confirms on the title screen.
export function createInput(canvas) {
  const input = {
    clicks: [],
    keys: [],
    mouse: { x: 0, y: 0 },
  };
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.clicks.push({
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    });
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.push(event.code);
  });
  input.takeClicks = () => {
    const out = input.clicks;
    input.clicks = [];
    return out;
  };
  input.takeKeys = () => {
    const out = input.keys;
    input.keys = [];
    return out;
  };
  return input;
}

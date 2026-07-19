export function getDateKey(date = new Date()) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}
export function getDateLabel(date = new Date()) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function getTimeLabel(date = new Date()) {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function getTimestampLabel(date = new Date()) {
  return `${getDateLabel(date)} ${getTimeLabel(date)}`;
}
export function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23,59,59,999);
  return { start, end, startKey: getDateKey(start), endKey: getDateKey(end) };
}

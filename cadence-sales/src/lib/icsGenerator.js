// ICS calendar file generator — pure client-side string generation, no server calls needed.
// Excludes internal/private notes from the calendar description.

function formatIcsDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(text) {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function generateIcs(meeting) {
  const uid = `cadence-meeting-${meeting.id}@cadence.app`;
  const dtstamp = formatIcsDate(new Date());
  const dtstart = formatIcsDate(meeting.starts_at);
  const dtend = formatIcsDate(meeting.ends_at || new Date(new Date(meeting.starts_at).getTime() + 60 * 60 * 1000));

  const location = meeting.meeting_url || meeting.location || '';
  const description = meeting.client_visible_notes || meeting.description || '';

  const attendeeLines = (meeting.attendee_emails || [])
    .map((email) => `ATTENDEE:mailto:${email}`)
    .join('\r\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cadence//Meeting//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcsText(meeting.title || 'Meeting')}`,
  ];

  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  if (attendeeLines) lines.push(attendeeLines);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

export function downloadIcs(meeting) {
  const ics = generateIcs(meeting);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(meeting.title || 'meeting').replace(/[^a-z0-9]/gi, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
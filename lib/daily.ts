/**
 * Daily.co API client wrapper
 *
 * Provides functions to create rooms and meeting tokens using Daily REST API.
 */

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = "https://api.daily.co/v1";

interface DailyRoomResponse {
  id: string;
  name: string;
  url: string;
  created_at: string;
  config: Record<string, unknown>;
}

interface DailyMeetingTokenResponse {
  token: string;
}

/**
 * Create a Daily room for a consultation
 *
 * @param roomName - Unique room name (typically consultation ID)
 * @param expiryMinutes - Minutes until room expires (default 60)
 * @returns Room name and URL
 */
export async function createRoom(
  roomName: string,
  expiryMinutes: number = 60
): Promise<{ name: string; url: string }> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY environment variable is not set");
  }

  // Guardrails for free tier: fail-fast if someone tries to toggle HIPAA/recording env knobs.
  if ((process.env.DAILY_HIPAA_MODE || "").toLowerCase() === "true") {
    throw new Error(
      "DAILY_HIPAA_MODE=true is not supported in this project (Daily free tier / no Healthcare add-on)."
    );
  }
  if ((process.env.DAILY_RECORDING_MODE || "").length > 0) {
    throw new Error(
      "DAILY_RECORDING_MODE is not supported in this project (recording disabled on free tier config)."
    );
  }

  const expiryTime = Math.floor(Date.now() / 1000) + expiryMinutes * 60;

  const response = await fetch(`${DAILY_API_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        exp: expiryTime,
        enable_chat: true,
        enable_screenshare: true,
        enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
        eject_at_room_exp: true,
        // Limit to 2 participants (patient + doctor)
        max_participants: 2,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Daily API error:", error);
    throw new Error(`Failed to create Daily room: ${response.status}`);
  }

  const data: DailyRoomResponse = await response.json();

  return {
    name: data.name,
    url: data.url,
  };
}

/**
 * Create a meeting token for a participant
 *
 * Token grants access to the room with specific permissions.
 *
 * @param roomName - The room to grant access to
 * @param userId - User ID for tracking
 * @param isOwner - If true, grants owner privileges (can end call, etc.)
 * @returns JWT meeting token
 */
export async function createMeetingToken(
  roomName: string,
  userId: string,
  isOwner: boolean = false
): Promise<string> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY environment variable is not set");
  }

  // Token expires in 1 hour
  const expiryTime = Math.floor(Date.now() / 1000) + 60 * 60;

  const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId,
        is_owner: isOwner,
        exp: expiryTime,
        // Enable camera and mic
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Daily API error:", error);
    throw new Error(`Failed to create meeting token: ${response.status}`);
  }

  const data: DailyMeetingTokenResponse = await response.json();

  return data.token;
}

/**
 * Delete a Daily room
 *
 * @param roomName - Room name to delete
 */
export async function deleteRoom(roomName: string): Promise<void> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY environment variable is not set");
  }

  const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    console.error("Daily API error:", error);
    throw new Error(`Failed to delete Daily room: ${response.status}`);
  }
}

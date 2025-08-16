package com.webRTC.Videocall.Controller;


import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.json.JSONObject;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Handles signaling between WebRTC participants.
 */
public class SignalingHandler extends TextWebSocketHandler {
    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, String> sessionRoomMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
        String roomId = sessionRoomMap.get(session);
        if (roomId != null) {
            Set<WebSocketSession> participants = rooms.get(roomId);
            if (participants != null) {
                participants.remove(session);
                if (participants.isEmpty()) rooms.remove(roomId);
            }
        }
        sessionRoomMap.remove(session);
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        JSONObject msg = new JSONObject(message.getPayload());
        String type = msg.optString("type");
        String roomId = msg.optString("roomId");
        String displayName = msg.optString("displayName", "unknown");

        switch (type) {
            case "join": {
                rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
                sessionRoomMap.put(session, roomId);

                JSONObject relayMsg = new JSONObject()
                        .put("type", "user-joined")
                        .put("roomId", roomId)
                        .put("displayName", displayName);
                relayToOthers(session, roomId, relayMsg);
                break;
            }
            case "leave": {
                Set<WebSocketSession> participants = rooms.get(roomId);
                if (participants != null) {
                    participants.remove(session);
                    JSONObject relayMsg = new JSONObject()
                            .put("type", "user-left")
                            .put("roomId", roomId)
                            .put("displayName", displayName);
                    relayToOthers(session, roomId, relayMsg);
                    if (participants.isEmpty()) rooms.remove(roomId);
                }
                sessionRoomMap.remove(session);
                break;
            }
            case "offer":
            case "answer":
            case "ice-candidate": {
                relayToOthers(session, roomId, msg);
                break;
            }
            default:
                // Optionally log unrecognized message
                break;
        }
    }

    private void relayToOthers(WebSocketSession sender, String roomId, JSONObject message) {
        Set<WebSocketSession> participants = rooms.get(roomId);
        if (participants == null) return;
        for (WebSocketSession participant : participants) {
            if (!participant.equals(sender) && participant.isOpen()) {
                try {
                    participant.sendMessage(new TextMessage(message.toString()));
                } catch (Exception ignored) {
                }
            }
        }
    }
}

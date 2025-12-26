"use client"

// Simplified toast for now
import { useState, useEffect } from "react"

export const useToast = () => {
    const [toasts, setToasts] = useState<any[]>([])

    const toast = ({ title, description, variant }: any) => {
        alert(`${title}: ${description}`) // Fallback to alert for simplicity if no provider
    }

    return { toast }
}

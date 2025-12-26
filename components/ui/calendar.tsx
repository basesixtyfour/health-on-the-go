"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                root: "w-full",
                months: "relative flex flex-col sm:flex-row gap-4",
                month: "w-full",
                month_caption: "relative flex h-9 items-center justify-center z-0",
                caption_label: "text-sm font-medium",
                nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between z-10",
                button_previous: cn(
                    buttonVariants({ variant: "outline" }),
                    "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 cursor-pointer"
                ),
                button_next: cn(
                    buttonVariants({ variant: "outline" }),
                    "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 cursor-pointer"
                ),
                weekdays: "flex",
                weekday: "w-9 text-[0.8rem] font-normal text-muted-foreground text-center",
                month_grid: "mt-4",
                week: "flex mt-2",
                day: cn(
                    "relative size-9 p-0 text-center text-sm",
                    "[&:has([aria-selected])]:bg-accent [&:has([aria-selected].outside)]:bg-accent/50",
                    "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
                    "[&:has([aria-selected].range_end)]:rounded-r-md"
                ),
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "size-9 p-0 font-normal aria-selected:opacity-100 cursor-pointer"
                ),
                range_start: "range_start",
                range_end: "range_end",
                range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                today: "bg-accent text-accent-foreground",
                outside: "outside text-muted-foreground opacity-50 aria-selected:opacity-30",
                disabled: "text-muted-foreground opacity-50",
                hidden: "invisible",
                chevron: "size-4",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation }) =>
                    orientation === "left"
                        ? <ChevronLeft className="size-4" />
                        : <ChevronRight className="size-4" />
            }}
            {...props}
        />
    )
}

Calendar.displayName = "Calendar"

export { Calendar }

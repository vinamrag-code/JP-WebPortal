"use client";

import { useEffect, useState } from "react";
import { ArtificialWebPortal } from "./scripts/artificialW";
import { setExamDates } from '@/components/scripts/cache';
import {
  saveExamSemestersToCache,
  getExamSemestersFromCache,
  saveExamEventsToCache,
  getExamEventsFromCache,
  saveExamScheduleToCache,
  getExamScheduleFromCache,
  getUsername
} from '@/components/scripts/cache';
import { Helmet } from 'react-helmet-async';
import { showErrorToast } from '@/lib/toastUtils';

export default function Exams({
  w,
  examSchedule,
  setExamSchedule,
  examSemesters,
  setExamSemesters,
  selectedExamSem,
  setSelectedExamSem,
  selectedExamEvent,
  setSelectedExamEvent,
}) {
  const [examEvents, setExamEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);

  const isOffline = w && (w instanceof ArtificialWebPortal || (w.constructor && w.constructor.name === 'ArtificialWebPortal'))
  
  // Load cached data when offline
  useEffect(() => {
    const loadCachedData = async () => {
      if (!isOffline) return;
      
      setLoading(true);
      setIsFromCache(true);
      
      try {
        const username = getUsername();
        if (!username) return;
        
        // Load cached exam semesters
        const cachedSemesters = await getExamSemestersFromCache(username);
        if (cachedSemesters && cachedSemesters.length > 0) {
          setExamSemesters(cachedSemesters);
          
          // Try to restore selected semester from localStorage
          const storedSemesterId = localStorage.getItem('selectedExamSemesterId');
          let semesterToSelect = null;
          
          if (storedSemesterId) {
            semesterToSelect = cachedSemesters.find(sem => sem.registration_id === storedSemesterId);
          }
          
          // Fallback to first semester
          semesterToSelect = semesterToSelect || cachedSemesters[0];
          
          if (semesterToSelect) {
            setSelectedExamSem(semesterToSelect);
            
            // Load cached exam events for the selected semester
            const cachedEvents = await getExamEventsFromCache(semesterToSelect.registration_id, username);
            if (cachedEvents && cachedEvents.length > 0) {
              setExamEvents(cachedEvents);
              
              // Try to restore selected event from localStorage
              const storedEventId = localStorage.getItem('selectedExamEventId');
              let eventToSelect = null;
              
              if (storedEventId) {
                eventToSelect = cachedEvents.find(evt => evt.exam_event_id === storedEventId);
              }
              
              // Fallback to first event
              eventToSelect = eventToSelect || cachedEvents[0];
              
              if (eventToSelect) {
                setSelectedExamEvent(eventToSelect);
                
                // Load cached exam schedule for the selected event
                const cachedSchedule = await getExamScheduleFromCache(eventToSelect.exam_event_id, username);
                if (cachedSchedule) {
                  setExamSchedule({
                    [eventToSelect.exam_event_id]: cachedSchedule,
                  });
                  updateExamDates(cachedSchedule);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load cached exam data:", error);
        showErrorToast('Exams', error?.message || 'Failed to load cached exam data.');
      } finally {
        setLoading(false);
      }
    };
    
    loadCachedData();
  }, [isOffline]);

  const updateExamDates = (examScheduleData) => {
    if (!examScheduleData || examScheduleData.length === 0) {
      return;
    }

    try {
      const examDates = examScheduleData.map((exam) => exam.datetime);
      const examDatesAsDate = examDates.map((dateStr) => {
        const [day, month, year] = dateStr.split("/");
        return new Date(`${month}/${day}/${year}`);
      });

      const earliestDate = new Date(Math.min(...examDatesAsDate));
      const latestDate = new Date(Math.max(...examDatesAsDate));

      setExamDates(earliestDate.toISOString(), latestDate.toISOString());
    } catch (error) {
      console.error("Failed to update exam dates:", error);
    }
  }; 

  // Persist selected exam event to localStorage
  useEffect(() => {
    if (selectedExamEvent) {
      localStorage.setItem('selectedExamEventId', selectedExamEvent.exam_event_id);
    }
  }, [selectedExamEvent?.exam_event_id]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (isOffline) return; // Skip fetching when offline
      
      if (examSemesters.length === 0) {
        setLoading(true);
        try {
          const username = getUsername();
          const examSems = await w.get_semesters_for_exam_events();
          setExamSemesters(examSems);
          
          // Save to cache
          if (username) {
            await saveExamSemestersToCache(examSems, username);
          }

          if (examSems.length > 0) {
            const currentYear = new Date().getFullYear().toString();
            const currentYearSemester = examSems.find(sem =>
              sem.registration_code && sem.registration_code.includes(currentYear)
            );
            const selectedSemester = currentYearSemester || examSems[examSems.length - 1];
            setSelectedExamSem(selectedSemester);
            localStorage.setItem('selectedExamSemesterId', selectedSemester.registration_id);

            const events = await w.get_exam_events(selectedSemester);
            setExamEvents(events);
            
            // Save events to cache
            if (username) {
              await saveExamEventsToCache(events, selectedSemester.registration_id, username);
            }

            if (events.length > 0) {
              const storedEventId = localStorage.getItem('selectedExamEventId');
              let eventToSelect = null;
              
              if (storedEventId) {
                eventToSelect = events.find(evt => evt.exam_event_id === storedEventId);
              }
              
              // Fallback to last event if stored event not found
              eventToSelect = eventToSelect || events[events.length - 1];
              
              setSelectedExamEvent(eventToSelect);

              const response = await w.get_exam_schedule(eventToSelect);
              setExamSchedule({
                [eventToSelect.exam_event_id]: response.subjectinfo,
              });
              
              // Save schedule to cache
              if (username) {
                await saveExamScheduleToCache(response.subjectinfo, eventToSelect.exam_event_id, username);
              }
              
              updateExamDates(response.subjectinfo);
            }
          }
        } finally {
          setLoading(false);
        }
      } else if (selectedExamSem && examEvents.length === 0) {
        setLoading(true);
        try {
          const username = getUsername();
          const events = await w.get_exam_events(selectedExamSem);
          setExamEvents(events);
          
          // Save events to cache
          if (username) {
            await saveExamEventsToCache(events, selectedExamSem.registration_id, username);
          }
          
          if (events.length > 0 && !selectedExamEvent) {
            // Try to restore from localStorage
            const storedEventId = localStorage.getItem('selectedExamEventId');
            let eventToSelect = null;
            
            if (storedEventId) {
              eventToSelect = events.find(evt => evt.exam_event_id === storedEventId);
            }
            
            // Fallback to last event if stored event not found
            eventToSelect = eventToSelect || events[events.length - 1];
            
            setSelectedExamEvent(eventToSelect);
          }
        } finally {
          setLoading(false);
        }
      }
    };
    fetchInitialData();
  }, [
    w,
    setExamSemesters,
    setSelectedExamSem,
    setSelectedExamEvent,
    setExamSchedule,
    examSemesters,
    selectedExamSem,
    examEvents.length,
    selectedExamEvent,
    isOffline,
  ]);

  if (isOffline && examSemesters.length === 0) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-auto text-center">
          <h2 className="text-xl font-semibold text-foreground">Exam Schedule Unavailable</h2>
          <p className="text-muted-foreground mt-2">Exam schedule is not available while offline. Connect to the internet to view exam schedules.</p>
        </div>
      </div>
    );
  }

  const handleSemesterChange = async (value) => {
    setLoading(true);
    try {
      const semester = examSemesters.find(
        (sem) => sem.registration_id === value
      );
      setSelectedExamSem(semester);
      localStorage.setItem('selectedExamSemesterId', value); // Store selected semester
      const events = await w.get_exam_events(semester);
      setExamEvents(events);
      setSelectedExamEvent(null);
      localStorage.removeItem('selectedExamEventId'); // Clear stored event when semester changes
      setExamSchedule({});

      // Save events to cache
      const username = getUsername();
      if (username && !isOffline) {
        await saveExamEventsToCache(events, semester.registration_id, username);
      }

      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        setSelectedExamEvent(lastEvent);
        const response = await w.get_exam_schedule(lastEvent);
        setExamSchedule({
          [lastEvent.exam_event_id]: response.subjectinfo,
        });
        
        // Save schedule to cache
        if (username && !isOffline) {
          await saveExamScheduleToCache(response.subjectinfo, lastEvent.exam_event_id, username);
        }
        
        updateExamDates(response.subjectinfo);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEventChange = async (value) => {
    setLoading(true);
    try {
      const selectedEvent = examEvents.find(
        (evt) => evt.exam_event_id === value
      );
      setSelectedExamEvent(selectedEvent);
      // Store selected event to localStorage
      localStorage.setItem('selectedExamEventId', value);

      if (!examSchedule[value]) {
        const response = await w.get_exam_schedule(selectedEvent);
        setExamSchedule((prev) => ({
          ...prev,
          [value]: response.subjectinfo,
        }));
        
        // Save schedule to cache
        const username = getUsername();
        if (username && !isOffline) {
          await saveExamScheduleToCache(response.subjectinfo, value, username);
        }
        
        updateExamDates(response.subjectinfo);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentSchedule =
    selectedExamEvent && examSchedule[selectedExamEvent.exam_event_id];

  return (
    <>
      <Helmet>
        <title>Exams - JP Portal | JIIT Student Portal</title>
        <meta name="description" content="View exam schedules and downloadable schedules for your semesters at JIIT." />
        <meta name="keywords" content="JIIT exams, exam schedule, JP Portal" />
        <link rel="canonical" href="https://jportal2-0.vercel.app/#/exams" />
      </Helmet>
      <div className="px-4 py-3 flex flex-col gap-4">
        <div className="wp-card gap-3.5">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>Select Semester</label>
            <div className="relative">
              <select className="wp-select" value={selectedExamSem?.registration_id || ""} onChange={(e) => handleSemesterChange(e.target.value)}>
                <option value="" disabled>Choose your semester</option>
                {examSemesters.map((sem) => (
                  <option key={sem.registration_id} value={sem.registration_id}>{sem.registration_code}</option>
                ))}
              </select>
              <i className="ph ph-caret-down" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))", pointerEvents: "none" }} />
            </div>
          </div>
          {selectedExamSem && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>Select Exam Event</label>
              <div className="relative">
                <select className="wp-select" value={selectedExamEvent?.exam_event_id || ""} onChange={(e) => handleEventChange(e.target.value)}>
                  <option value="" disabled>Choose exam event</option>
                  {examEvents.map((event) => (
                    <option key={event.exam_event_id} value={event.exam_event_id}>{event.exam_event_desc}</option>
                  ))}
                </select>
                <i className="ph ph-caret-down" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))", pointerEvents: "none" }} />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : currentSchedule?.length > 0 ? (
          <ExamScheduleGrid currentSchedule={currentSchedule} />
        ) : selectedExamEvent ? (
          <div className="wp-card items-center text-center gap-2.5" style={{ padding: "32px 20px" }}>
            <i className="ph ph-calendar-x" style={{ fontSize: 36, color: "hsl(var(--muted-foreground))" }} />
            <div className="text-base font-semibold">No Exam Schedule Available</div>
            <p className="text-[12.5px] leading-relaxed m-0" style={{ color: "hsl(var(--muted-foreground))" }}>
              There are no exams scheduled for the selected exam event. Please check back later or select a different exam event.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

function ExamScheduleGrid({ currentSchedule }) {
  const now = new Date();

  const parseExamDateTime = (dateStr, timeStr) => {
    const [day, month, year] = dateStr.split("/");
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":");

    let hour24 = parseInt(hours);
    if (period?.toUpperCase() === "PM" && hour24 !== 12) {
      hour24 += 12;
    } else if (period?.toUpperCase() === "AM" && hour24 === 12) {
      hour24 = 0;
    }

    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour24,
      parseInt(minutes)
    );
  };

  // Sort exams by date and time
  const sortedSchedule = [...currentSchedule].sort((a, b) => {
    const dateA = parseExamDateTime(a.datetime, a.datetimefrom || "00:00");
    const dateB = parseExamDateTime(b.datetime, b.datetimefrom || "00:00");
    return dateA - dateB;
  });

  // The design highlights the single soonest upcoming exam with a "SOON" badge, rather than a countdown on
  // every card (ExamCard/useCountdown's per-second timer is still available if a future pass wants it back).
  const nearest = sortedSchedule.find((exam) => parseExamDateTime(exam.datetime, exam.datetimefrom || "00:00") > now);

  return (
    <div className="flex flex-col gap-2">
      {sortedSchedule.map((exam) => (
        <ExamCard
          key={`${exam.subjectcode}-${exam.datetime}-${exam.datetimefrom}`}
          exam={exam}
          isNearest={exam === nearest}
        />
      ))}
    </div>
  );
}

/**
 * One exam row, matching the design: a day/month block, subject name/code, and room/seat with a "SOON"
 * badge on the single soonest upcoming exam (see ExamScheduleGrid). Kept as a list row rather than the
 * previous 2-column card grid.
 */
function ExamCard({ exam, isNearest }) {
  const [day, month] = exam.datetime.split("/");
  const monthName = new Date(2000, Number(month) - 1, 1).toLocaleDateString("en-US", { month: "short" });

  return (
    <div className="wp-card flex-row items-center gap-3">
      <div className="flex-none text-center" style={{ width: 44 }}>
        <div className="text-[17px] font-bold leading-none">{day}</div>
        <div className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{monthName}</div>
      </div>
      <div className="flex-none rounded-full" style={{ width: 2, alignSelf: "stretch", background: "hsl(var(--border))" }} />
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-medium truncate">{exam.subjectdesc.split("(")[0].trim()}</div>
        <div className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
          {exam.subjectcode} · {exam.datetimefrom}{exam.datetimeupto ? `–${exam.datetimeupto}` : ""}
        </div>
      </div>
      <div className="flex-none text-right flex flex-col items-end gap-0.5" style={{ minWidth: 64 }}>
        {isNearest && (
          <span className="wp-chip" style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))", whiteSpace: "nowrap" }}>SOON</span>
        )}
        {exam.roomcode && <div className="text-[12.5px] font-bold whitespace-nowrap">{exam.roomcode}</div>}
        {exam.seatno && <div className="text-[10.5px] whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>Seat {exam.seatno}</div>}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="wp-card flex-row items-center gap-3 animate-pulse">
          <div className="rounded" style={{ width: 44, height: 34, background: "hsl(var(--muted))" }} />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="rounded" style={{ height: 14, width: "70%", background: "hsl(var(--muted))" }} />
            <div className="rounded" style={{ height: 10, width: "45%", background: "hsl(var(--muted))" }} />
          </div>
          <div className="rounded" style={{ height: 14, width: 40, background: "hsl(var(--muted))" }} />
        </div>
      ))}
    </div>
  );
}

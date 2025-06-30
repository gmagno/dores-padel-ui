// Configuration object for app settings
const config = {
    // apiUrl: 'http://192.168.0.7:7777/example.json' // Default API URL, can be changed
    // apiUrl: 'http://localhost:8787/bookings' // Default API URL, can be changed
    apiUrl: 'https://dores-padel.dores.workers.dev/bookings' // Default API URL, can be changed
};

// Store the court data globally
let courtData = null;

// Load the data when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Show loading state
    document.getElementById('all-days-container').innerHTML = '<div class="loading"><span class="loading-text">Loading court data</span></div>';

    // Fetch data from the external source
    fetchCourtData()
        .then(data => {
            courtData = data;
            displayAllDays();
        })
        .catch(error => {
            console.error('Error loading court data:', error);
            document.getElementById('all-days-container').innerHTML =
                `<div class="error">Error loading court data: ${error.message}</div>`;
        });
});

// Function to update the API URL
function updateApiUrl(newUrl) {
    config.apiUrl = newUrl;
    // Show loading state
    document.getElementById('all-days-container').innerHTML = '<div class="loading"><span class="loading-text">Loading court data</span></div>';
    // Reload data with the new URL
    fetchCourtData()
        .then(data => {
            courtData = data;
            displayAllDays();
        })
        .catch(error => {
            console.error('Error loading court data:', error);
            document.getElementById('all-days-container').innerHTML =
                `<div class="error">Error loading court data: ${error.message}</div>`;
        });
}

// Function to display all days at once, with multiple days side by side
function displayAllDays() {
    const allDaysContainer = document.getElementById('all-days-container');

    // Clear previous content
    allDaysContainer.innerHTML = '';

    // Get all dates and sort them
    const dates = Object.keys(courtData).sort();

    if (dates.length === 0) {
        allDaysContainer.innerHTML = '<div class="error">No court data available</div>';
        return;
    }

    // Create a single matrix container for all days
    const matrixContainer = document.createElement('div');
    matrixContainer.className = 'matrix-container';

    // Create the matrix table
    const table = document.createElement('table');
    table.className = 'court-matrix multi-day';

    // Generate 30-minute time slots from 7:00 to 23:30
    const timeSlots = generate30MinTimeSlots();

    // Create header row with day and court names
    const headerRow = document.createElement('tr');

    // Add empty cell for the top-left corner
    const cornerCell = document.createElement('th');
    cornerCell.className = 'time-header';
    cornerCell.textContent = 'Time / Court';
    headerRow.appendChild(cornerCell);

    // Process each date
    dates.forEach(dateString => {
        const dateData = courtData[dateString];
        if (!dateData || !dateData.courts || dateData.courts.length === 0) {
            return; // Skip days with no court data
        }

        // Format the date for display
        const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
        const dateObj = new Date(year, month - 1, day);
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'numeric',
            day: 'numeric'
        });

        // Get all courts for this day
        const courts = dateData.courts;

        // Group courts by type (regular vs covered)
        const regularCourts = courts.filter(court => !court.name.includes('Coberto'));
        const coveredCourts = courts.filter(court => court.name.includes('Coberto'));

        // Pre-process all courts to create a mapping of 30-minute slots to their status
        const courtStatusMap = {};

        // Process regular courts (1-6) with 1.5-hour slots
        regularCourts.forEach(court => {
            courtStatusMap[court.name] = {};

            // For each 1.5-hour slot in the regular court
            court.timeSlots.forEach(slot => {
                const [startTime, endTime] = slot.time.split(' - ');

                // Convert to minutes for easier calculation
                const startMinutes = timeToMinutes(startTime);
                const endMinutes = timeToMinutes(endTime);

                // Generate all 30-minute slots within this time range
                for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
                    const slotStartHour = Math.floor(minutes / 60);
                    const slotStartMinute = minutes % 60;
                    const slotEndHour = Math.floor((minutes + 30) / 60);
                    const slotEndMinute = (minutes + 30) % 60;

                    const slotStart = `${slotStartHour.toString().padStart(2, '0')}:${slotStartMinute.toString().padStart(2, '0')}`;
                    const slotEnd = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMinute.toString().padStart(2, '0')}`;

                    const thirtyMinSlot = `${slotStart} - ${slotEnd}`;
                    courtStatusMap[court.name][thirtyMinSlot] = slot;
                }
            });
        });

        // Process covered courts (A and B) with 1-hour slots
        coveredCourts.forEach(court => {
            courtStatusMap[court.name] = {};

            // For each 1-hour slot in the covered court
            court.timeSlots.forEach(slot => {
                const [startTime, endTime] = slot.time.split(' - ');
                const hour = parseInt(startTime.split(':')[0], 10);

                // Map both 30-minute slots within this hour to the same status
                const firstHalfSlot = `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:30`;
                const secondHalfSlot = `${hour.toString().padStart(2, '0')}:30 - ${(hour + 1).toString().padStart(2, '0')}:00`;

                courtStatusMap[court.name][firstHalfSlot] = slot;
                courtStatusMap[court.name][secondHalfSlot] = slot;
            });
        });

        // Add day header that spans all courts for this day
        const dayHeader = document.createElement('th');
        dayHeader.className = 'day-header';
        dayHeader.textContent = formattedDate;
        dayHeader.colSpan = courts.length;
        headerRow.appendChild(dayHeader);

        // Add court headers under the day header
        courts.forEach(court => {
            // Store the court and its status map for later use when creating rows
            court.statusMap = courtStatusMap[court.name];
            court.dateString = dateString;
        });
    });

    table.appendChild(headerRow);

    // Create a second header row for court names
    const courtHeaderRow = document.createElement('tr');

    // Add empty cell for the time column
    const timeColumnHeader = document.createElement('th');
    timeColumnHeader.className = 'time-header';
    courtHeaderRow.appendChild(timeColumnHeader);

    // Add court headers for each day
    dates.forEach(dateString => {
        const dateData = courtData[dateString];
        if (!dateData || !dateData.courts || dateData.courts.length === 0) {
            return; // Skip days with no court data
        }

        const courts = dateData.courts;

        // Add court headers
        courts.forEach(court => {
            const courtHeader = document.createElement('th');
            // Add different class for covered courts
            const isCovered = court.name.includes('Coberto');
            courtHeader.className = `court-header ${isCovered ? 'covered-court' : 'regular-court'}`;

            // Extract court number/letter from name (e.g., "Padel Quadra 1" -> "1")
            const courtLabel = court.name.replace('Padel Quadra ', '').replace('.', '');
            courtHeader.textContent = courtLabel;

            // Add title attribute for tooltip on hover
            courtHeader.title = court.fullName;

            courtHeaderRow.appendChild(courtHeader);
        });
    });

    table.appendChild(courtHeaderRow);

    // Create rows for each time slot
    timeSlots.forEach(timeSlot => {
        const row = document.createElement('tr');

        // Add time slot header
        const timeHeader = document.createElement('td');
        timeHeader.className = 'time-header';
        timeHeader.textContent = timeSlot;
        row.appendChild(timeHeader);

        // Add cells for each court for each day
        dates.forEach(dateString => {
            const dateData = courtData[dateString];
            if (!dateData || !dateData.courts || dateData.courts.length === 0) {
                return; // Skip days with no court data
            }

            const courts = dateData.courts;

            // Add cells for each court
            courts.forEach(court => {
                const cell = document.createElement('td');
                const isCovered = court.name.includes('Coberto');

                // Get the status map for this court
                const courtStatusMap = {};
                courts.forEach(c => {
                    if (c.name === court.name) {
                        courtStatusMap[timeSlot] = c.statusMap ? c.statusMap[timeSlot] : null;
                    }
                });

                const matchingSlot = courtStatusMap[timeSlot];

                if (matchingSlot) {
                    const isAvailable = matchingSlot.status === 'Livre';

                    cell.className = `court-cell ${isAvailable ? 'available' : 'reserved'} ${isCovered ? 'covered-court' : 'regular-court'}`;

                    // Add title attribute for tooltip on hover
                    cell.title = `${court.name}, ${timeSlot}, ${dateString}: ${matchingSlot.status}`;

                    // If available, make it clickable
                    if (isAvailable && matchingSlot.bookingUrl) {
                        cell.addEventListener('click', () => {
                            // In a real app, this would navigate to the booking page
                            alert(`You would be redirected to book this slot: ${court.name}, ${timeSlot}, ${dateString}`);
                        });
                    }
                } else {
                    // No data for this time slot and court
                    cell.className = 'court-cell no-data';
                }

                row.appendChild(cell);
            });
        });

        table.appendChild(row);
    });

    matrixContainer.appendChild(table);
    allDaysContainer.appendChild(matrixContainer);
}

// Function to fetch court data from the external source
async function fetchCourtData() {
    try {
        // Add CORS mode and credentials
        const response = await fetch(config.apiUrl, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);

        // If there's a CORS error or any other network error, 
        // display a more user-friendly error message
        if (error.message.includes('CORS') || error.name === 'TypeError') {
            document.getElementById('all-days-container').innerHTML = `
                <div class="error">
                    <p>Unable to fetch data from ${config.apiUrl}</p>
                    <p>This may be due to CORS restrictions when running locally.</p>
                    <p>Error details: ${error.message}</p>
                </div>
            `;
        }

        throw error;
    }
}

// Function to generate 30-minute time slots from 7:00 to 23:30
function generate30MinTimeSlots() {
    const timeSlots = [];
    const startHour = 7;
    const endHour = 23;

    for (let hour = startHour; hour <= endHour; hour++) {
        // First 30 minutes of the hour
        const firstHalf = `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:30`;
        timeSlots.push(firstHalf);

        // Second 30 minutes of the hour (except for the last slot at 23:30)
        if (hour < endHour) {
            const secondHalf = `${hour.toString().padStart(2, '0')}:30 - ${(hour + 1).toString().padStart(2, '0')}:00`;
            timeSlots.push(secondHalf);
        }
    }

    return timeSlots;
}

// This function is no longer needed as we're using the pre-processed map for all courts

// Helper function to convert time string (HH:MM) to minutes since midnight
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Store the court data globally
let courtData = null;

// Load the data when the page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Since we're creating a static app without a server, we'll include the data directly
        // This avoids issues with the file:// protocol restrictions in browsers
        courtData = getCourtData();

        // Display all days at once
        displayAllDays();
    } catch (error) {
        console.error('Error loading court data:', error);
        document.getElementById('all-days-container').innerHTML = '<div class="error">Error loading court data</div>';
    }
});

// Function to display all days at once
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

    // Create a section for each day
    dates.forEach(dateString => {
        const dateData = courtData[dateString];
        if (!dateData || !dateData.courts || dateData.courts.length === 0) {
            return; // Skip days with no court data
        }

        // Create day container
        const dayContainer = document.createElement('div');
        dayContainer.className = 'day-container';

        // Format the date for display
        // Parse the date parts to ensure correct local date
        const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
        const dateObj = new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Create day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = formattedDate;
        dayContainer.appendChild(dayHeader);

        // Create matrix container for this day
        const matrixContainer = document.createElement('div');
        matrixContainer.className = 'matrix-container';

        // Get all courts for this day
        const courts = dateData.courts;

        // Group courts by type (regular vs covered)
        const regularCourts = courts.filter(court => !court.name.includes('Coberto'));
        const coveredCourts = courts.filter(court => court.name.includes('Coberto'));
        
        // Generate 30-minute time slots from 7:00 to 23:30
        const timeSlots = generate30MinTimeSlots();

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

        // Create the matrix table
        const table = document.createElement('table');
        table.className = 'court-matrix';

        // Create header row with court names
        const headerRow = document.createElement('tr');
        
        // Add empty cell for the top-left corner
        const cornerCell = document.createElement('th');
        cornerCell.className = 'time-header';
        cornerCell.textContent = 'Time / Court';
        headerRow.appendChild(cornerCell);
        
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
            
            headerRow.appendChild(courtHeader);
        });
        
        table.appendChild(headerRow);

        // Create rows for each time slot
        timeSlots.forEach(timeSlot => {
            const row = document.createElement('tr');
            
            // Add time slot header
            const timeHeader = document.createElement('td');
            timeHeader.className = 'time-header';
            timeHeader.textContent = timeSlot;
            row.appendChild(timeHeader);
            
// Add cells for each court
courts.forEach(court => {
    const cell = document.createElement('td');
    const isCovered = court.name.includes('Coberto');
    
    // Use the pre-processed map for all courts
    const matchingSlot = courtStatusMap[court.name][timeSlot];
    
    if (matchingSlot) {
        const isAvailable = matchingSlot.status === 'Livre';
        
        cell.className = `court-cell ${isAvailable ? 'available' : 'reserved'} ${isCovered ? 'covered-court' : 'regular-court'}`;
        
        // Add title attribute for tooltip on hover
        cell.title = `${court.name}, ${timeSlot}: ${matchingSlot.status}`;
        
        // If available, make it clickable
        if (isAvailable && matchingSlot.bookingUrl) {
            cell.addEventListener('click', () => {
                // In a real app, this would navigate to the booking page
                alert(`You would be redirected to book this slot: ${court.name}, ${timeSlot}`);
            });
        }
    } else {
        // No data for this time slot and court
        cell.className = 'court-cell no-data';
    }
    
    row.appendChild(cell);
});
            
            table.appendChild(row);
        });

        matrixContainer.appendChild(table);
        dayContainer.appendChild(matrixContainer);
        allDaysContainer.appendChild(dayContainer);
    });
}

// Function to get the court data from example.json
function getCourtData() {
    // Read the example.json file directly
    // This is a workaround for local file access in a static HTML page
    const jsonData = document.getElementById('court-data').textContent;
    return JSON.parse(jsonData);
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

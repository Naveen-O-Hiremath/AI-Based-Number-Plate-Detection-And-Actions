// Static reference lists used to synthesize realistic-looking (but entirely
// fictional) demo records — no real vehicle, owner, or government data.

export const STATE_CODES = [
    'KA', 'MH', 'DL', 'TN', 'AP', 'TS', 'KL', 'GJ', 'RJ', 'UP',
    'MP', 'WB', 'PB', 'HR', 'BR', 'OD', 'AS', 'JH', 'CG', 'UK',
    'HP', 'GA', 'PY',
];

export const CITIES_BY_STATE = {
    KA: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi'],
    MH: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
    DL: ['New Delhi', 'Dwarka', 'Rohini', 'Saket'],
    TN: ['Chennai', 'Coimbatore', 'Madurai', 'Trichy'],
    AP: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
    TS: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
    KL: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'],
    GJ: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
    RJ: ['Jaipur', 'Udaipur', 'Jodhpur', 'Kota'],
    UP: ['Lucknow', 'Kanpur', 'Noida', 'Agra'],
    MP: ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur'],
    WB: ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur'],
    PB: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
    HR: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala'],
    BR: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur'],
    OD: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri'],
    AS: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat'],
    JH: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
    CG: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba'],
    UK: ['Dehradun', 'Haridwar', 'Nainital', 'Roorkee'],
    HP: ['Shimla', 'Manali', 'Dharamshala', 'Solan'],
    GA: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
    PY: ['Puducherry', 'Karaikal'],
};

export const FIRST_NAMES = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna',
    'Ishaan', 'Rohan', 'Kabir', 'Aryan', 'Dhruv', 'Karan', 'Manish', 'Rahul',
    'Suresh', 'Ramesh', 'Vikram', 'Anil', 'Sanjay', 'Rajesh', 'Deepak', 'Ashok',
    'Naveen', 'Prakash', 'Ganesh', 'Mahesh', 'Yash', 'Siddharth',
    'Ananya', 'Diya', 'Ishita', 'Kavya', 'Meera', 'Priya', 'Riya', 'Saanvi',
    'Tanvi', 'Aditi', 'Neha', 'Pooja', 'Sneha', 'Anjali', 'Divya', 'Kiran',
    'Lakshmi', 'Manju', 'Nisha', 'Radha', 'Sunita', 'Usha', 'Vandana', 'Swati',
];

export const LAST_NAMES = [
    'Sharma', 'Verma', 'Gupta', 'Reddy', 'Rao', 'Nair', 'Menon', 'Iyer',
    'Iyengar', 'Pillai', 'Naidu', 'Chowdhury', 'Banerjee', 'Mukherjee', 'Das',
    'Ghosh', 'Patel', 'Shah', 'Mehta', 'Desai', 'Singh', 'Kumar', 'Yadav',
    'Chauhan', 'Rathore', 'Malhotra', 'Kapoor', 'Khanna', 'Bhat', 'Hegde',
    'Gowda', 'Shetty', 'Kulkarni', 'Joshi', 'Pawar', 'Deshmukh', 'Mishra',
    'Tiwari', 'Pandey', 'Dubey',
];

export const VEHICLE_TYPES = [
    { type: 'Car', makes: { 'Maruti Suzuki': ['Swift', 'Baleno', 'Dzire', 'Ertiga'], 'Hyundai': ['i20', 'Creta', 'Venue', 'Verna'], 'Tata': ['Nexon', 'Punch', 'Altroz'], 'Honda': ['City', 'Amaze'] } },
    { type: 'SUV', makes: { 'Mahindra': ['XUV700', 'Scorpio', 'Thar', 'Bolero'], 'Toyota': ['Fortuner', 'Urban Cruiser'], 'Kia': ['Seltos', 'Sonet'] } },
    { type: 'Motorcycle', makes: { 'Hero': ['Splendor', 'Passion'], 'Honda': ['Shine', 'Activa'], 'Bajaj': ['Pulsar', 'Avenger'], 'TVS': ['Apache', 'Jupiter'], 'Royal Enfield': ['Classic 350', 'Hunter 350'] } },
    { type: 'Truck', makes: { 'Tata Motors': ['407', 'Prima', 'Ace'], 'Ashok Leyland': ['Dost', 'Boss'], 'Eicher': ['Pro 2049'] } },
    { type: 'Bus', makes: { 'Tata Motors': ['Starbus', 'Marcopolo'], 'Ashok Leyland': ['Viking', 'Falcon'] } },
    { type: 'Auto Rickshaw', makes: { 'Bajaj': ['RE Compact', 'Maxima'], 'Piaggio': ['Ape'] } },
    { type: 'Van', makes: { 'Maruti Suzuki': ['Eeco', 'Omni'], 'Tata': ['Winger'] } },
];

export const COLORS = ['White', 'Silver', 'Grey', 'Black', 'Red', 'Blue', 'Brown', 'Green', 'Maroon', 'Yellow'];

export const RTO_SERIES_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export const ROGUE_REASONS = [
    'Reported stolen vehicle',
    'Wanted in connection with theft case',
    'Flagged by state crime records bureau',
    'Suspected involvement in smuggling',
    'Repeated hit-and-run offender',
    'Court non-appearance warrant',
    'Flagged in inter-state alert bulletin',
    'Suspected fake registration plate',
    'Linked to organized crime investigation',
    'Absconding from custody',
];

export const CAMERA_LOCATION_NAMES = [
    'Silk Board Jn', 'Hebbal Flyover', 'KR Puram Bridge', 'Marathahalli Bridge',
    'Anna Salai', 'MG Road Jn', 'Banjara Hills Rd 12', 'Hitech City Jn',
    'Sion Circle', 'Dadar TT Circle', 'Connaught Place', 'ITO Crossing',
    'Vashi Toll Plaza', 'Electronic City Toll', 'Hosur Road Toll',
    'NH-44 Km 112', 'NH-48 Km 78', 'NH-16 Km 45', 'Ring Road Jn 4',
    'Airport Approach Rd', 'Railway Station Rd', 'Central Market Jn',
    'Outer Ring Road', 'Old Madras Road', 'Whitefield Main Rd',
];

export function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pad(num, size) {
    return String(num).padStart(size, '0');
}

export function randomDateBetween(daysAgoMin, daysAgoMax) {
    const now = Date.now();
    const daysAgo = randInt(daysAgoMin, daysAgoMax);
    const ms = now - daysAgo * 24 * 60 * 60 * 1000 - randInt(0, 86400000);
    return new Date(ms);
}

export function toSqlDateTime(d) {
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function toSqlDate(d) {
    return d.toISOString().slice(0, 10);
}

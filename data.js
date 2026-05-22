const DUMMY_CONTACT_OPTIONS = ["Yes", "Yes", "No", "NA"];
const DUMMY_NETWORK_OPTIONS = ["Yes", "In Progress", "No", "NA", "Yes"];
const DUMMY_MEETING_OPTIONS = ["In Progress", "NA", "No", "Yes", "Yes"];
const DUMMY_IT_SPOCS = ["Amit Sharma", "Sneha Gupta", "Ravi Kumar", "Pooja Nair", "Nitin Das", "Farah Khan"];
const DUMMY_REMARKS = [
  "Awaiting final room count from case team.",
  "Connectivity request raised with local IT.",
  "Shared checklist with case SPOC.",
  "No dedicated meeting room required as of now.",
  "Network test completed for primary workspace.",
  "Follow-up planned after staffing confirmation.",
];

function dummyDate(day, monthIndex, year = 2026) {
  return Date.UTC(year, monthIndex, day);
}

function dummyDateText(timestamp) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function dummyCase(index, caseName, caseLocation, caseTeamSpoc, start, end, caseCode, sourceRows) {
  return {
    key: `${caseCode.toLowerCase()}::${caseName.toLowerCase()}`,
    caseName,
    caseLocation,
    caseTeamSpoc,
    caseStartDate: dummyDateText(start),
    caseEndDate: dummyDateText(end),
    caseStartValue: start,
    caseEndValue: end,
    caseCode,
    sourceRows,
    sourceStatus: "Latest file",
    editable: {
      itTeamSpoc: DUMMY_IT_SPOCS[index % DUMMY_IT_SPOCS.length],
      caseTeamContacted: DUMMY_CONTACT_OPTIONS[index % DUMMY_CONTACT_OPTIONS.length],
      networkConnectivity: DUMMY_NETWORK_OPTIONS[index % DUMMY_NETWORK_OPTIONS.length],
      meetingRoomEnablement: DUMMY_MEETING_OPTIONS[index % DUMMY_MEETING_OPTIONS.length],
      remarks: DUMMY_REMARKS[index % DUMMY_REMARKS.length],
    },
  };
}

window.STAFFING_DASHBOARD_INITIAL_DATA = {
  generatedAt: "2026-05-22T05:00:00.000Z",
  sourceName: "Dummy Staffing Sheet May 2026.csv",
  sourcePath: "dummy-staffing-source.csv",
  sourceRows: 67,
  cases: [
    dummyCase(0, "Apex Materials Cost Reset", "Chennai", "Meera Joshi / Team member 2", dummyDate(30, 2), dummyDate(22, 4), "BC-26016", 2),
    dummyCase(1, "Zenith Auto Digital Factory", "Bengaluru", "Priya Shah / Team member 2 / Team member 3", dummyDate(6, 3), dummyDate(12, 5), "BC-26010", 3),
    dummyCase(2, "Harbor FMCG Route-to-Market", "Kolkata", "Leela Banerjee / Team member 2", dummyDate(8, 3), dummyDate(20, 5), "BC-26018", 2),
    dummyCase(3, "Bluewater Insurance Transition", "Pune", "Mira Kapoor / Team member 2", dummyDate(15, 3), dummyDate(31, 4), "BC-26006", 2),
    dummyCase(4, "Atlas Pharma Site Launch", "Bengaluru", "Diya Rao / Team member 2", dummyDate(20, 3), dummyDate(29, 4), "BC-26002", 2),
    dummyCase(5, "Sterling Mining Transformation", "Kolkata", "Rhea Mukherjee / Team member 2 / Team member 3 / Team member 4", dummyDate(21, 3), dummyDate(3, 6), "BC-26024", 4),
    dummyCase(6, "Crescent Hotels Experience Lab", "Goa", "Nikhil Arora / Team member 2", dummyDate(27, 3), dummyDate(5, 5), "BC-26011", 2),
    dummyCase(7, "Indus Chemicals PMO", "Hyderabad / Chennai", "Karan Desai / Team member 2", dummyDate(28, 3), dummyDate(10, 5), "BC-26021", 2),
    dummyCase(8, "Summit Consumer Growth Pod", "Gurgaon", "Ishaan Bose / Team member 2 / Team member 3", dummyDate(1, 4), dummyDate(30, 5), "BC-26007", 3),
    dummyCase(9, "Pulse Health Operating Model", "Hyderabad", "Aditya Jain / Team member 2 / Team member 3 / Team member 4", dummyDate(4, 4), dummyDate(17, 6), "BC-26013", 4),
    dummyCase(10, "Northstar Retail Network Readiness", "Mumbai", "Aarav Mehta / Team member 2 / Team member 3", dummyDate(5, 4), dummyDate(19, 5), "BC-26001", 3),
    dummyCase(11, "Prism Wealth Cloud Rollout", "Gurgaon", "Aisha Khan / Team member 2 / Team member 3", dummyDate(7, 4), dummyDate(26, 5), "BC-26022", 3),
    dummyCase(12, "Quantum SaaS Scale-Up", "Bengaluru", "Neha Krishnan / Team member 2", dummyDate(11, 4), dummyDate(3, 6), "BC-26014", 2),
    dummyCase(13, "Orion Bank Client Room Enablement", "Delhi", "Kabir Sinha / Team member 2 / Team member 3 / Team member 4", dummyDate(12, 4), dummyDate(24, 6), "BC-26003", 4),
    dummyCase(14, "Cobalt Retail Analytics Room", "Mumbai", "Naina Chatterjee / Team member 2 / Team member 3", dummyDate(13, 4), dummyDate(15, 6), "BC-26020", 3),
    dummyCase(15, "Vertex Private Equity Diligence", "Delhi / Gurgaon", "Tara Dutta / Team member 2 / Team member 3", dummyDate(14, 4), dummyDate(26, 5), "BC-26012", 3),
    dummyCase(16, "Evergreen Manufacturing War Room", "Chennai", "Rohan Iyer / Team member 2 / Team member 3", dummyDate(18, 4), dummyDate(10, 6), "BC-26005", 3),
    dummyCase(17, "Meridian Payments Launch Office", "Pune", "Rahul Verma / Team member 2 / Team member 3", dummyDate(19, 4), dummyDate(31, 6), "BC-26017", 3),
    dummyCase(18, "Terra Logistics Control Tower", "Mumbai / Pune", "Dev Malhotra / Team member 2 / Team member 3 / Team member 4", dummyDate(25, 4), dummyDate(14, 7), "BC-26009", 4),
    dummyCase(19, "Helios Energy Connectivity Sprint", "Hyderabad", "Anika Nair / Team member 2", dummyDate(1, 5), dummyDate(31, 6), "BC-26004", 2),
    dummyCase(20, "Saffron Aviation Ops Desk", "Delhi", "Arjun Pillai / Team member 2 / Team member 3 / Team member 4", dummyDate(2, 5), dummyDate(18, 8), "BC-26019", 4),
    dummyCase(21, "Nova Telecom Migration", "Kolkata", "Sara Menon / Team member 2", dummyDate(9, 5), dummyDate(21, 7), "BC-26008", 2),
    dummyCase(22, "Lotus Grocery Site Support", "Bengaluru", "Om Patel / Team member 2", dummyDate(16, 5), dummyDate(11, 8), "BC-26023", 2),
    dummyCase(23, "Beacon Media Marketplace", "Mumbai", "Vikram Sen / Team member 2 / Team member 3", dummyDate(22, 5), dummyDate(28, 7), "BC-26015", 3),
  ],
};

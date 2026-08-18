# HireScore API Documentation

Complete REST API reference for the **HireScore v2** platform.

---

## Table of Contents

1. [Architecture & Overview](#architecture--overview)
2. [Student Management](#1-student-management)
   - [`GET /api/students`](#get-apistudents)
   - [`POST /api/students`](#post-apistudents)
   - [`PATCH /api/students`](#patch-apistudents)
   - [`DELETE /api/students`](#delete-apistudents)
   - [`GET /api/students/history`](#get-apistudentshistory)
3. [Scores & Analytics](#2-scores--analytics)
   - [`GET /api/scores`](#get-apiscores)
   - [`GET /api/scores/[regNo]`](#get-apiscoresregno)
   - [`GET /api/recalculate`](#get-apirecalculate)
4. [NQT Assessment Module](#3-nqt-assessment-module)
   - [`GET /api/nqt`](#get-apinqt)
   - [`DELETE /api/nqt`](#delete-apinqt)
   - [`POST /api/nqt/import`](#post-apinqtimport)
   - [`POST /api/nqt/clean`](#post-apinqtclean)
5. [Excel Data Import](#4-excel-data-import)
   - [`POST /api/import/primary`](#post-apiimportprimary)
   - [`POST /api/import/secondary`](#post-apiimportsecondary)
6. [File Storage (FTP/SFTP)](#5-file-storage-ftpsftp)
   - [`POST /api/upload-file`](#post-apiupload-file)
7. [Settings & Organization](#6-settings--organization)
   - [`GET /api/settings`](#get-apisettings)
   - [`PUT /api/settings`](#put-apisettings)
   - [`PATCH /api/settings/rename-course`](#patch-apisettingsrename-course)
8. [Share Tokens & Public Links](#7-share-tokens--public-links)
   - [`GET /api/share-tokens`](#get-apishare-tokens)
   - [`POST /api/share-tokens`](#post-apishare-tokens)
   - [`PATCH /api/share-tokens`](#patch-apishare-tokens)
   - [`DELETE /api/share-tokens`](#delete-apishare-tokens)
   - [`DELETE /api/share-tokens/[id]`](#delete-apishare-tokensid)
   - [`GET /api/share-tokens/by-token/[token]`](#get-apishare-tokensby-tokentoken)
9. [LeetCode Integrations](#8-leetcode-integrations)
   - [`GET /api/leetcode-rank`](#get-apileetcode-rank)
   - [`POST /api/leetcode-rank`](#post-apileetcode-rank)
10. [PDF Export](#9-pdf-export)
   - [`GET /api/export-pdf/[id]`](#get-apiexport-pdfid)

---

## Architecture & Overview

- **Base URL:** `http://localhost:3000` (or your production deployment domain)
- **Response Format:** Standard JSON (`application/json`) unless exporting binary PDF (`application/pdf`).
- **Authentication & Security:** Internal APIs use server-side MySQL connection pooling. Public shared dashboard views use cryptographically secure token validation (`/api/share-tokens/by-token/[token]`).

---

## 1. Student Management

### `GET /api/students`
**Source:** [students/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/students/route.ts#L7)  
Fetch students list. Can retrieve all students or apply multi-dimensional filters.

- **Method:** `GET`
- **Query Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `college` | `string` | No | Single college name filter |
  | `colleges` | `string` (JSON array) | No | JSON string array of colleges, e.g. `["College A","College B"]` |
  | `courses` | `string` (JSON array) | No | JSON string array of course/department names, e.g. `["CSE","ECE"]` |
  | `years` | `string` (JSON array) | No | JSON string array of batch years, e.g. `["2025","2026"]` |
  | `degreeType` | `string` | No | Degree type filter (`"ug"`, `"pg"`, or `"all"`) |

- **Sample Request:**
  ```http
  GET /api/students?colleges=%5B%22Sample+Institute%22%5D&degreeType=ug HTTP/1.1
  ```

- **Response:** `200 OK`
  ```json
  [
    {
      "id": "std_12345",
      "name": "Jane Doe",
      "registrationNumber": "21CS001",
      "department": "CSE",
      "year": "2025",
      "college": "Sample Institute of Technology",
      "degreeType": "ug",
      "hireScore": 765.4,
      "quants": 40,
      "verbal": 38,
      "logical": 42,
      "fopAssessment": 65,
      "dsaAssessment": 85
    }
  ]
  ```

---

### `POST /api/students`
**Source:** [students/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/students/route.ts#L32)  
Create a new student or update an existing student record (matched by ID, registration number, email, or phone).

- **Method:** `POST`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "registrationNumber": "21CS001",
    "department": "CSE",
    "year": "2025",
    "college": "Sample Institute of Technology",
    "email": "jane.doe@example.com",
    "phone": "9876543210",
    "xMarks": 92.5,
    "xiiMarks": 94.0,
    "ugPercentage": 8.5,
    "quants": 45,
    "verbal": 40,
    "logical": 42
  }
  ```
- **Response:**
  - `201 Created` (if newly created) / `200 OK` (if updated)
  - Body: Updated/created `StudentData` object.

---

### `PATCH /api/students`
**Source:** [students/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/students/route.ts#L55)  
Bulk update college assignment for students (optionally scoped to a department).

- **Method:** `PATCH`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "college": "Updated College Name",
    "department": "CSE"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "updated": 45
  }
  ```

---

### `DELETE /api/students`
**Source:** [students/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/students/route.ts#L67)  
Delete a single student by ID or delete a batch of students by registration number range.

- **Method:** `DELETE`
- **Query Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `id` | `string` | Conditional | Unique student ID |
  | `range` | `string` | Conditional | Registration number range, e.g. `21CS001-21CS050` |

- **Response:** `200 OK`
  ```json
  {
    "deleted": 1
  }
  ```

---

### `GET /api/students/history`
**Source:** [students/history/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/students/history/route.ts#L6)  
Retrieve audit/change logs and score history for a specific student.

- **Method:** `GET`
- **Query Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `regNo` | `string` | **Yes** | Student registration number |

- **Response:** `200 OK`
  ```json
  [
    {
      "id": 1,
      "registrationNumber": "21CS001",
      "action": "PRIMARY_IMPORT",
      "changedFields": { "quants": 45, "hireScore": 780 },
      "createdAt": "2026-08-18T05:30:00.000Z"
    }
  ]
  ```

---

## 2. Scores & Analytics

### `GET /api/scores`
**Source:** [scores/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/scores/route.ts#L32)  
Get standard formatted scores for all students, a filtered list, or a single student via query parameters.

- **Method:** `GET`
- **Query Parameters:**
  | Parameter | Type | Description |
  | :--- | :--- | :--- |
  | `regNo` / `registrationNumber` | `string` | Fetch a single student's score summary |
  | `college` / `colleges` | `string` / `JSON array` | Filter by college(s) |
  | `courses` | `JSON array` | Filter by courses |
  | `years` | `JSON array` | Filter by years |
  | `degreeType` | `string` | Filter by degree type (`"ug"`, `"pg"`, `"all"`) |

- **Response:** `200 OK`
  ```json
  {
    "registrationNumber": "21CS001",
    "name": "Jane Doe",
    "college": "Sample Institute of Technology",
    "department": "CSE",
    "year": "2025",
    "scores": {
      "fopAssessment": 65,
      "dsaAssessment": 85,
      "quants": 40,
      "verbal": 38,
      "logical": 42
    },
    "computedScores": {
      "quantsScore": 40,
      "verbalScore": 38,
      "logicalScore": 42,
      "aptitudeTotal": 120,
      "technicalProficiency": 150,
      "hireScore": 765.4
    },
    "updatedAt": "2026-08-18T10:00:00.000Z"
  }
  ```

---

### `GET /api/scores/[regNo]`
**Source:** [scores/[regNo]/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/scores/%5BregNo%5D/route.ts#L179)  
Get full score breakdown with denominator normalization and merged NQT assessment modules.

- **Method:** `GET`
- **Path Parameter:** `regNo` — Registration number (URL encoded)
- **Response:** `200 OK`
  ```json
  {
    "registrationNumber": "21CS001",
    "name": "Jane Doe",
    "college": "Sample Institute of Technology",
    "department": "CSE",
    "year": "2025",
    "hireScore": 765,
    "fpcNqtAssessment": {
      "tableHeader": "FPC NQT Assessment",
      "hasNqtData": true,
      "noOfAssessmentConducted": 2,
      "numericalAbilityPercentage": 85.5,
      "verbalAbilityPercentage": 90.0,
      "reasoningAbilityPercentage": 80.0,
      "advancedQuantitativeAndReasoningAbilityPercentage": 75.0,
      "aptitudeAveragePercentage": 82.63,
      "codingAveragePercentage": 70.0,
      "overallAveragePercentage": 76.32
    },
    "scores": {
      "fopAssessment": 56.25,
      "dsaAssessment": 70.0,
      "quants": 42.75,
      "verbal": 45.0,
      "logical": 40.0,
      "hireScore": 765
    },
    "percentages": {
      "fopAssessment": 75.0,
      "dsaAssessment": 70.0,
      "quants": 85.5,
      "verbal": 90.0,
      "logical": 80.0,
      "aptitudeTotal": 85.17,
      "overallAverage": 76.32
    },
    "maxDenominators": {
      "fopAssessment": 75,
      "dsaAssessment": 100,
      "quants": 50,
      "verbal": 50,
      "logical": 50,
      "aptitudeTotal": 150
    },
    "breakdown": {
      "fopAssessment": { "score": 56.25, "maxDenominator": 75, "percentage": 75, "displayScore": "56.25/75", "displayPercentage": "75%" }
    }
  }
  ```

---

### `GET /api/recalculate`
**Source:** [recalculate/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/recalculate/route.ts#L6)  
Recalculate hire scores for all students in the database according to current weightage criteria.

- **Method:** `GET`
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Successfully recalculated scores for 1520 students."
  }
  ```

---

## 3. NQT Assessment Module

### `GET /api/nqt`
**Source:** [nqt/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/nqt/route.ts#L6)  
Retrieve consolidated NQT assessment attempts, summary metrics, and batch metadata.

- **Method:** `GET`
- **Query Parameters:**
  | Parameter | Type | Description |
  | :--- | :--- | :--- |
  | `regNo` | `string` | Filter by registration number, name, or email |
  | `college` | `string` | Filter by college name |
  | `department` | `string` | Filter by department |

- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "totalStudents": 450,
    "totalAssessments": 3,
    "summary": {
      "totalEvaluated": 450,
      "averageAptitude": 78.45,
      "averageCoding": 62.1,
      "averageOverall": 70.28
    },
    "students": [
      {
        "registrationNumber": "21CS001",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "department": "CSE",
        "college": "Sample College",
        "hireScore": 765,
        "numerical": 85,
        "verbal": 90,
        "reasoning": 80,
        "advQuant": 75,
        "aptitude": 82.5,
        "coding": 70,
        "overall": 76.25,
        "firstOverall": 65.0,
        "latestOverall": 76.25,
        "deltaOverall": 11.25,
        "attemptsCount": 2,
        "attempts": [...]
      }
    ],
    "assessments": [...]
  }
  ```

---

### `DELETE /api/nqt`
**Source:** [nqt/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/nqt/route.ts#L193)  
Delete an uploaded NQT assessment batch from the database.

- **Method:** `DELETE`
- **Query Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `id` | `string` | Optional | Assessment ID |
  | `name` | `string` | Optional | Assessment name |

- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Deleted assessment NQT_Assessment_Batch_1"
  }
  ```

---

### `POST /api/nqt/import`
**Source:** [nqt/import/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/nqt/import/route.ts#L7)  
Upload and parse an Excel sheet containing NQT assessment results, syncing with students in the DB.

- **Method:** `POST`
- **Request Headers:** `Content-Type: multipart/form-data`
- **FormData Fields:**
  | Field | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `file` | `File` (`.xlsx`/`.xls`) | **Yes** | Excel file of NQT assessment scores |

- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "savedToDb": true,
    "assessments": [...]
  }
  ```

---

### `POST /api/nqt/clean`
**Source:** [nqt/clean/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/nqt/clean/route.ts#L12)  
Resets test scores for students outside permitted colleges and recalculates scores.

- **Method:** `POST`
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Cleared NQT test scores for all colleges except Takshashila University, SDNB Vaishnav College for Women, and S-VYASA University.",
    "allowedColleges": ["Takshashila University", "SDNB Vaishnav College for Women", "S-VYASA University"],
    "affectedAptitudeRows": 120,
    "affectedTechnicalRows": 120,
    "recalculatedTotal": 1500
  }
  ```

---

## 4. Excel Data Import

### `POST /api/import/primary`
**Source:** [import/primary/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/import/primary/route.ts#L83)  
Upload the primary master student Excel database. Inserts or completely updates student profiles.

- **Method:** `POST`
- **Request Headers:** `Content-Type: multipart/form-data`
- **FormData Fields:**
  | Field | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `file` | `File` (`.xlsx`/`.xls`) | **Yes** | Master Excel file |
  | `mapping` | `string` (JSON object) | Optional | Column index to field mapping (e.g. `{"0":"name","1":"registrationNumber"}`) |

- **Response:** `200 OK`
  ```json
  {
    "imported": 412
  }
  ```

---

### `POST /api/import/secondary`
**Source:** [import/secondary/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/import/secondary/route.ts#L42)  
Upload secondary assessment spreadsheets (e.g., test scores, contest ranks) to patch existing students without wiping profile data.

- **Method:** `POST`
- **Request Headers:** `Content-Type: multipart/form-data`
- **FormData Fields:**
  | Field | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `file` | `File` (`.xlsx`/`.xls`) | **Yes** | Score update Excel file |
  | `mapping` | `string` (JSON object) | Optional | Column index to field mapping |

- **Response:** `200 OK`
  ```json
  {
    "updated": 350,
    "matched": 350,
    "unmatched": 12,
    "unmatchedRegNos": ["21CS999"],
    "totalInFile": 362
  }
  ```

---

## 5. File Storage (FTP/SFTP)

### `POST /api/upload-file`
**Source:** [upload-file/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/upload-file/route.ts#L26)  
Upload student certificates, marksheets, and attachments directly to the remote server via FTP.

- **Method:** `POST`
- **Request Headers:** `Content-Type: multipart/form-data`
- **FormData Fields:**
  | Field | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `file` | `File` (PDF/Images/XLSX) | **Yes** | Max 10MB file |
  | `path` | `string` | **Yes** | Relative path, e.g. `21CS001/marksheets/x.pdf` |

- **Response:** `200 OK`
  ```json
  {
    "url": "https://faceprepcampus.com/uploads/21CS001/marksheets/x.pdf",
    "path": "21CS001/marksheets/x.pdf",
    "name": "x.pdf",
    "size": 245102
  }
  ```

---

## 6. Settings & Organization

### `GET /api/settings`
**Source:** [settings/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/settings/route.ts#L4)  
Retrieve global configuration, scoring weightages, colleges, and courses list.

- **Method:** `GET`
- **Response:** `200 OK`
  ```json
  {
    "weights": {
      "academic": 0.2,
      "cognitive": 0.3,
      "technical": 0.35,
      "industry": 0.15
    },
    "colleges": [...]
  }
  ```

---

### `PUT /api/settings`
**Source:** [settings/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/settings/route.ts#L12)  
Save updated application settings, weights, or college configurations.

- **Method:** `PUT`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:** JSON object representing settings
- **Response:** `200 OK`

---

### `PATCH /api/settings/rename-course`
**Source:** [settings/rename-course/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/settings/rename-course/route.ts#L9)  
Rename a department/course in a specific college so all related students update consistently.

- **Method:** `PATCH`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "collegeName": "Sample College",
    "oldName": "B.Tech CSE",
    "newName": "Computer Science & Engineering"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "ok": true,
    "updated": 120
  }
  ```

---

## 7. Share Tokens & Public Links

### `GET /api/share-tokens`
**Source:** [share-tokens/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/share-tokens/route.ts#L6)  
Get all generated shareable dashboard tokens.

- **Method:** `GET`
- **Response:** `200 OK`
  ```json
  [
    {
      "id": "tok_1",
      "token": "a1b2c3d4e5f6",
      "colleges": ["Sample College"],
      "courses": ["CSE"],
      "years": ["2025"],
      "createdAt": "2026-08-18T10:00:00.000Z"
    }
  ]
  ```

---

### `POST /api/share-tokens`
**Source:** [share-tokens/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/share-tokens/route.ts#L16)  
Create a new access token restricted to selected colleges, courses, and years.

- **Method:** `POST`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "colleges": ["Sample College"],
    "courses": ["CSE", "ECE"],
    "years": ["2025"]
  }
  ```
- **Response:** `201 Created`

---

### `PATCH /api/share-tokens`
**Source:** [share-tokens/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/share-tokens/route.ts#L41)  
Update an existing share token's filter scopes.

- **Method:** `PATCH`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "id": "tok_1",
    "colleges": ["Sample College"],
    "courses": ["CSE"],
    "years": ["2025", "2026"]
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true
  }
  ```

---

### `DELETE /api/share-tokens` / `DELETE /api/share-tokens/[id]`
**Source:** [share-tokens/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/share-tokens/route.ts#L70) & [share-tokens/[id]/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/share-tokens/%5Bid%5D/route.ts#L6)  
Revoke/delete a share token by query parameter or route parameter.

- **Method:** `DELETE`
- **Route / Query:** `DELETE /api/share-tokens?id=tok_1` OR `DELETE /api/share-tokens/tok_1`
- **Response:** `200 OK`
  ```json
  {
    "success": true
  }
  ```

---

### `GET /api/share-tokens/by-token/[token]`
**Source:** [share-tokens/by-token/[token]/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/share-tokens/by-token/%5Btoken%5D/route.ts#L6)  
Validate a share token from a public link and retrieve allowed access filters.

- **Method:** `GET`
- **Path Parameter:** `token` — Token string
- **Response:** `200 OK`
  ```json
  {
    "token": "a1b2c3d4e5f6",
    "colleges": ["Sample College"],
    "courses": ["CSE"],
    "years": ["2025"]
  }
  ```

---

## 8. LeetCode Integrations

### `GET /api/leetcode-rank`
**Source:** [leetcode-rank/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/leetcode-rank/route.ts#L119)  
Background worker endpoint to automatically sync outdated student LeetCode rankings (batches of 10).

- **Method:** `GET`
- **Response:** `200 OK`
  ```json
  {
    "message": "Successfully synced 10 LeetCode ranks.",
    "updated": 10,
    "remaining": 45,
    "totalOutdated": 55
  }
  ```

---

### `POST /api/leetcode-rank`
**Source:** [leetcode-rank/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/leetcode-rank/route.ts#L67)  
Fetch ranking for a single username OR batch sync a list of specific student IDs.

- **Method:** `POST`
- **Request Headers:** `Content-Type: application/json`
- **Request Body (Option A — Single Username Lookup):**
  ```json
  {
    "username": "tourist"
  }
  ```
- **Response (Option A):** `200 OK`
  ```json
  {
    "ranking": 1204
  }
  ```

- **Request Body (Option B — Batch Sync by IDs):**
  ```json
  {
    "ids": ["std_1", "std_2", "std_3"]
  }
  ```
- **Response (Option B):** `200 OK`
  ```json
  {
    "success": true,
    "updated": 3
  }
  ```

---

## 9. PDF Export

### `GET /api/export-pdf/[id]`
**Source:** [export-pdf/[id]/route.ts](file:///f:/Hire%20score/hire-score-v2/app/api/export-pdf/%5Bid%5D/route.ts#L7)  
Generates a printable A4 PDF report card for a student using Puppeteer and Chromium.

- **Method:** `GET`
- **Path Parameter:** `id` — Unique student ID
- **Response:**
  - `200 OK`
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="HIRE_Score_21CS001_Jane_Doe.pdf"`

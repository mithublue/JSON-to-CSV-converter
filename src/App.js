import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [jsonData, setJsonData] = useState([]);
  const [mergedJson, setMergedJson] = useState([]);
  const [dynamicKeys, setDynamicKeys] = useState([]);
  const [useCustomKeys, setUseCustomKeys] = useState(false);
  const [customKeyConfigs, setCustomKeyConfigs] = useState([]);
  const [message, setMessage] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [converterMode, setConverterMode] = useState('csv'); // 'csv' or 'sql'
  const [tableName, setTableName] = useState('my_table'); // Default table name for SQL mode

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      setMessage('Upload canceled. Previous data retained.');
      return;
    }

    const parsedData = [];
    let error = null;
    const allKeys = new Set();

    const readers = files.map(file => {
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) {
              throw new Error(`File ${file.name} is not an array.`);
            }
            data.forEach(item => {
              Object.keys(item).forEach(key => allKeys.add(key));
            });
            parsedData.push(data);
            resolve();
          } catch (err) {
            error = err;
            resolve();
          }
        };
        reader.onerror = () => {
          error = new Error(`Error reading file ${file.name}`);
          resolve();
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readers).then(() => {
      if (error) {
        setMessage(`Error: ${error.message}`);
        return;
      }
      const merged = parsedData.flat();
      const keys = Array.from(allKeys);
      setJsonData(parsedData);
      setMergedJson(merged);
      setDynamicKeys(keys);
      setCustomKeyConfigs(keys.map(key => ({
        jsonKey: key,
        columnName: key,
        isSelected: true,
        isCustom: false,
        defaultValue: '',
        isUnique: false // New field for SQL unique constraint
      })));
      setMessage(`Successfully loaded ${files.length} file(s) with ${merged.length} items and ${keys.length} unique keys.`);
    });
  };

  const handleCustomKeysToggle = () => {
    setUseCustomKeys(!useCustomKeys);
    setMessage('');
  };

  const handleKeyConfigChange = (index, field, value) => {
    const updatedConfigs = [...customKeyConfigs];
    updatedConfigs[index] = { ...updatedConfigs[index], [field]: value };
    setCustomKeyConfigs(updatedConfigs);
  };

  const handleDeleteRow = (index) => {
    const updatedConfigs = customKeyConfigs.filter((_, i) => i !== index);
    setCustomKeyConfigs(updatedConfigs);
    setMessage('Row deleted successfully.');
  };

  const handleAddCustomKey = () => {
    setCustomKeyConfigs([
      ...customKeyConfigs,
      {
        jsonKey: `custom_${customKeyConfigs.length + 1}`,
        columnName: '',
        isSelected: true,
        isCustom: true,
        defaultValue: '',
        isUnique: false // Initialize isUnique for new custom keys
      }
    ]);
    setMessage('Custom column added. Enter a column name and default value to include it in the output.');
  };

  const handleDragStart = (index) => (event) => {
    event.dataTransfer.setData('text/plain', index);
    setDragIndex(index);
  };

  const handleDragOver = (index) => (event) => {
    event.preventDefault();
  };

  const handleDrop = (index) => (event) => {
    event.preventDefault();
    const sourceIndex = parseInt(event.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex !== index) {
      const updatedConfigs = [...customKeyConfigs];
      const [movedItem] = updatedConfigs.splice(sourceIndex, 1);
      updatedConfigs.splice(index, 0, movedItem);
      setCustomKeyConfigs(updatedConfigs);
      setMessage('Columns reordered successfully.');
    }
    setDragIndex(null);
  };

  const handleConvertToCsv = () => {
    if (mergedJson.length === 0) {
      setMessage('No JSON data to convert. Please upload a JSON file.');
      return;
    }

    let keysToUse = [];
    let columnNames = [];
    if (useCustomKeys) {
      const selectedConfigs = customKeyConfigs.filter(config => config.isSelected);
      if (selectedConfigs.length === 0) {
        setMessage('Error: No keys selected for CSV conversion.');
        return;
      }
      keysToUse = selectedConfigs.map(config => config.jsonKey);
      columnNames = selectedConfigs.map(config => config.columnName || config.jsonKey);
    } else {
      if (dynamicKeys.length === 0) {
        setMessage('No keys available to convert. Please upload a JSON file.');
        return;
      }
      keysToUse = dynamicKeys;
      columnNames = dynamicKeys;
    }

    try {
      const escapeCsvField = (field, defaultValue) => {
        if (field === null || field === undefined) return defaultValue !== undefined ? `"${defaultValue.replace(/"/g, '""')}"` : '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const header = columnNames.join(',');
      const rows = mergedJson.map(item =>
          keysToUse.map((key, index) => {
            const config = customKeyConfigs.find(c => c.jsonKey === key && c.isSelected);
            return escapeCsvField(item[key], useCustomKeys && config ? config.defaultValue : undefined);
          }).join(',')
      );
      const csvContent = [header, ...rows].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', useCustomKeys ? 'Custom_Keys_Data.csv' : 'Converted_Data.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage('CSV file generated and downloaded successfully.');
    } catch (error) {
      setMessage(`Error generating CSV: ${error.message}`);
    }
  };

  const handleConvertToSql = () => {
    if (mergedJson.length === 0) {
      setMessage('No JSON data to convert. Please upload a JSON file.');
      return;
    }

    if (!tableName || tableName.trim() === '') {
      setMessage('Error: Table name cannot be empty.');
      return;
    }

    let keysToUse = [];
    let columnNames = [];
    if (useCustomKeys) {
      const selectedConfigs = customKeyConfigs.filter(config => config.isSelected);
      if (selectedConfigs.length === 0) {
        setMessage('Error: No keys selected for SQL conversion.');
        return;
      }
      keysToUse = selectedConfigs.map(config => config.jsonKey);
      columnNames = selectedConfigs.map(config => config.columnName || config.jsonKey);
    } else {
      if (dynamicKeys.length === 0) {
        setMessage('No keys available to convert. Please upload a JSON file.');
        return;
      }
      keysToUse = dynamicKeys;
      columnNames = dynamicKeys;
    }

    try {
      // Sanitize table name and column names for SQL (basic sanitization)
      const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
      const sanitizedColumnNames = columnNames.map(name => name.replace(/[^a-zA-Z0-9_]/g, '_'));

      // Check for duplicate column names
      const columnSet = new Set(sanitizedColumnNames);
      if (columnSet.size !== sanitizedColumnNames.length) {
        setMessage('Error: Duplicate column names detected after sanitization.');
        return;
      }

      // Check for duplicate values in unique columns
      const uniqueColumns = customKeyConfigs
          .filter(config => config.isSelected && config.isUnique)
          .map(config => ({ jsonKey: config.jsonKey, columnName: config.columnName || config.jsonKey }));
      for (const { jsonKey, columnName } of uniqueColumns) {
        const values = mergedJson.map(item => item[jsonKey] ?? (useCustomKeys ? customKeyConfigs.find(c => c.jsonKey === jsonKey)?.defaultValue : undefined));
        const valueSet = new Set(values);
        if (valueSet.size !== values.length) {
          setMessage(`Error: Duplicate values found in unique column "${columnName}".`);
          return;
        }
      }

      // Generate CREATE TABLE statement with unique constraints
      const uniqueConstraints = uniqueColumns.map(({ columnName }) => `UNIQUE (${columnName.replace(/[^a-zA-Z0-9_]/g, '_')})`).join(', ');
      const columnsWithTypes = sanitizedColumnNames.map((name, index) => {
        const config = customKeyConfigs[index];
        const isUnique = config?.isUnique ? ' UNIQUE' : '';
        return `${name} VARCHAR(255)${isUnique}`; // Assuming VARCHAR for simplicity; adjust as needed
      }).join(', ');
      const createTableSql = `CREATE TABLE IF NOT EXISTS ${sanitizedTableName} (${columnsWithTypes}${uniqueConstraints ? ', ' + uniqueConstraints : ''});\n`;

      // Generate INSERT statements
      const escapeSqlValue = (value, defaultValue) => {
        if (value === null || value === undefined) {
          return defaultValue !== undefined ? `'${defaultValue.replace(/'/g, "''")}'` : 'NULL';
        }
        const str = String(value);
        return `'${str.replace(/'/g, "''")}'`; // Escape single quotes
      };

      const insertStatements = mergedJson.map(item => {
        const values = keysToUse.map((key, index) => {
          const config = customKeyConfigs.find(c => c.jsonKey === key && c.isSelected);
          return escapeSqlValue(item[key], useCustomKeys && config ? config.defaultValue : undefined);
        });
        return `INSERT INTO ${sanitizedTableName} (${sanitizedColumnNames.join(', ')}) VALUES (${values.join(', ')});`;
      }).join('\n');

      const sqlContent = `${createTableSql}${insertStatements}`;

      const blob = new Blob([sqlContent], { type: 'text/sql;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${sanitizedTableName}_data.sql`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage('SQL file generated and downloaded successfully.');
    } catch (error) {
      setMessage(`Error generating SQL: ${error.message}`);
    }
  };

  const handleClearAll = () => {
    setJsonData([]);
    setMergedJson([]);
    setDynamicKeys([]);
    setCustomKeyConfigs([]);
    setUseCustomKeys(false);
    setConverterMode('csv'); // Reset to CSV mode
    setTableName('my_table'); // Reset table name
    setMessage('All JSON data cleared.');
  };

  return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="w-full max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-6">JSON to SQL/CSV Converter with Table Preview</h1>

          <div className="mb-6 flex justify-center space-x-4">
            <button
                onClick={() => setConverterMode('csv')}
                className={`px-4 py-2 rounded-lg font-bold ${converterMode === 'csv' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              CSV Converter
            </button>
            <button
                onClick={() => setConverterMode('sql')}
                className={`px-4 py-2 rounded-lg font-bold ${converterMode === 'sql' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              SQL Converter
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="jsonFiles">
              Upload JSON File(s)
            </label>
            <input
                id="jsonFiles"
                type="file"
                accept=".json"
                multiple
                onChange={handleFileUpload}
                className="w-full text-gray-700 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6 flex items-center">
            <label className="text-gray-700 text-sm font-bold mr-2">
              Use Custom Keys
            </label>
            <input
                type="checkbox"
                checked={useCustomKeys}
                onChange={handleCustomKeysToggle}
                className="h-5 w-5 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>

          {useCustomKeys && customKeyConfigs.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-gray-700 text-base font-bold">
                    Select, Rename, and Reorder Columns for {converterMode === 'csv' ? 'CSV' : 'SQL'}
                  </h2>
                  <button
                      onClick={handleAddCustomKey}
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Add Custom Column
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto border-collapse bg-white shadow-md">
                    <thead>
                    <tr className="bg-gray-200">
                      <th className="border px-4 py-2 text-left text-sm font-semibold w-12">Sort</th>
                      <th className="border px-4 py-2 text-left text-sm font-semibold">JSON Key</th>
                      <th className="border px-4 py-2 text-left text-sm font-semibold">
                        {converterMode === 'csv' ? 'CSV Column Name' : 'Table Column'}
                      </th>
                      <th className="border px-4 py-2 text-left text-sm font-semibold">Default Value</th>
                      {converterMode === 'sql' && (
                          <th className="border px-4 py-2 text-left text-sm font-semibold">Is Unique</th>
                      )}
                      <th className="border px-4 py-2 text-left text-sm font-semibold">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {customKeyConfigs.map((config, index) => (
                        <tr
                            key={config.jsonKey}
                            draggable
                            onDragStart={handleDragStart(index)}
                            onDragOver={handleDragOver(index)}
                            onDrop={handleDrop(index)}
                            className={`hover:bg-gray-50 ${dragIndex === index ? 'bg-gray-100' : ''}`}
                        >
                          <td className="border px-4 py-2 text-sm">
                            <svg className="w-5 h-5 text-gray-500 cursor-move" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                          </td>
                          <td className="border px-4 py-2 text-sm">
                            {config.isCustom ? 'Custom' : config.jsonKey}
                          </td>
                          <td className="border px-4 py-2 text-sm">
                            <input
                                type="text"
                                value={config.columnName}
                                onChange={(e) => handleKeyConfigChange(index, 'columnName', e.target.value)}
                                className="w-full border rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={config.isCustom ? "Enter column name" : "Enter column name"}
                            />
                          </td>
                          <td className="border px-4 py-2 text-sm">
                            <input
                                type="text"
                                value={config.defaultValue || ''}
                                onChange={(e) => handleKeyConfigChange(index, 'defaultValue', e.target.value)}
                                className="w-full border rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter default value"
                            />
                          </td>
                          {converterMode === 'sql' && (
                              <td className="border px-4 py-2 text-sm text-center">
                                <input
                                    type="checkbox"
                                    checked={config.isUnique || false}
                                    onChange={(e) => handleKeyConfigChange(index, 'isUnique', e.target.checked)}
                                    className="h-5 w-5 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                                />
                              </td>
                          )}
                          <td className="border px-4 py-2 text-sm text-center flex items-center justify-center space-x-2">
                            <input
                                type="checkbox"
                                checked={config.isSelected}
                                onChange={(e) => handleKeyConfigChange(index, 'isSelected', e.target.checked)}
                                className="h-5 w-5 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <button
                                onClick={() => handleDeleteRow(index)}
                                className="text-red-500 hover:text-red-700"
                                title="Delete row"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
          )}

          <div className="mb-6 space-y-3">
            {converterMode === 'sql' && (
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tableName">
                    Database Table Name
                  </label>
                  <input
                      id="tableName"
                      type="text"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      className="w-full text-gray-700 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter table name (e.g., my_table)"
                  />
                </div>
            )}
            {converterMode === 'csv' && (
                <button
                    onClick={handleConvertToCsv}
                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Convert to CSV
                </button>
            )}
            {converterMode === 'sql' && (
                <button
                    onClick={handleConvertToSql}
                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Convert to SQL
                </button>
            )}
            <button
                onClick={handleClearAll}
                className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Clear All
            </button>
          </div>

          <div className="mb-6 text-center text-sm" style={{ color: message.includes('Error') || message.includes('canceled') ? 'red' : 'green' }}>
            {message}
          </div>

          {mergedJson.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse bg-white shadow-md">
                  <thead>
                  <tr className="bg-gray-200">
                    {(useCustomKeys ? customKeyConfigs.filter(config => config.isSelected).map(config => config.columnName || config.jsonKey) : dynamicKeys).map((key) => (
                        <th key={key} className="border px-4 py-2 text-left text-sm font-semibold">
                          {key}
                        </th>
                    ))}
                  </tr>
                  </thead>
                  <tbody>
                  {mergedJson.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {(useCustomKeys ? customKeyConfigs.filter(config => config.isSelected).map(config => config.jsonKey) : dynamicKeys).map((key) => {
                          const config = customKeyConfigs.find(c => c.jsonKey === key && c.isSelected);
                          return (
                              <td key={key} className="border px-4 py-2 text-sm truncate max-w-xs">
                                {item[key] !== undefined && item[key] !== null
                                    ? String(item[key]).substring(0, 50) + (String(item[key]).length > 50 ? '...' : '')
                                    : (useCustomKeys && config && config.defaultValue ? config.defaultValue : '')}
                              </td>
                          );
                        })}
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>
        <footer className="text-center text-gray-600 text-sm py-4">
          Developed by Mithu A Quayium
        </footer>
      </div>
  );
};

export default App;
